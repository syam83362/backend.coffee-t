import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Observable, interval, startWith, switchMap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CafeEntity, CafeStatus } from '../database/entities/cafe.entity';
import { CafeStaffAssignmentEntity } from '../database/entities/cafe-staff-assignment.entity';
import { CafeInventoryEntity } from '../database/entities/cafe-inventory.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { CashCollectionEntity } from '../database/entities/cash-collection.entity';
import { ProductAvailabilityEntity, ProductChannel } from '../database/entities/product-availability.entity';
import { OrderEntity, OrderFulfillmentType, OrderStatus } from '../database/entities/order.entity';
import { OrderItemEntity } from '../database/entities/order-item.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { UserRole } from '../database/entities/user.entity';
import { WaiterCallEntity, WaiterCallStatus } from '../database/entities/waiter-call.entity';
import { DiningOrderDto } from './dto/dining-order.dto';

@Injectable()
export class CafesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CafeEntity) private readonly cafes: Repository<CafeEntity>,
    @InjectRepository(CafeTableEntity) private readonly tables: Repository<CafeTableEntity>,
    @InjectRepository(WaiterCallEntity) private readonly calls: Repository<WaiterCallEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
  ) {}

  listCafes(): Promise<CafeEntity[]> {
    return this.cafes.find({
      where: [{ status: CafeStatus.ACTIVE }, { status: CafeStatus.UPCOMING }],
      order: { city: 'ASC', name: 'ASC' },
    });
  }

  async getTableContext(tableCode: string, token: string | undefined) {
    const table = await this.authorizeTable(tableCode, token);
    if (table.cafe.status !== CafeStatus.ACTIVE) throw new NotFoundException('Café is not open');
    return {
      cafe: { id: table.cafe.id, name: table.cafe.name, city: table.cafe.city },
      table: { id: table.id, number: table.tableNumber },
    };
  }

  async callWaiter(tableCode: string, token: string | undefined) {
    const table = await this.authorizeTable(tableCode, token);
    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(CafeTableEntity)
        .createQueryBuilder('table')
        .setLock('pessimistic_write')
        .where('table.id = :id', { id: table.id })
        .getOne();
      const existing = await manager.getRepository(WaiterCallEntity).findOne({
        where: { cafeTableId: table.id, status: WaiterCallStatus.OPEN },
      });
      if (existing) return existing;
      return manager.getRepository(WaiterCallEntity).save(
        manager.getRepository(WaiterCallEntity).create({
          id: randomUUID(),
          cafeId: table.cafeId,
          cafeTableId: table.id,
          status: WaiterCallStatus.OPEN,
          resolvedByUserId: null,
          resolvedAt: null,
        }),
      );
    });
  }

  async createTableOrder(tableCode: string, token: string | undefined, dto: DiningOrderDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Customer-paid table orders are unavailable until a production payment provider is configured');
    }
    const table = await this.authorizeTable(tableCode, token);
    if (table.cafe.status !== CafeStatus.ACTIVE) throw new ConflictException('Café is not accepting orders');
    return this.dataSource.transaction((manager) =>
      this.createDiningOrder(manager, table.cafeId, table.id, OrderFulfillmentType.DINE_IN, dto, dto.requestId),
    );
  }

  async listAssignedCafes(user: AuthenticatedRequestUser) {
    if (user.role === UserRole.ADMIN) return this.cafes.find({ order: { name: 'ASC' } });
    this.assertStaffRole(user);
    const assignments = await this.dataSource.getRepository(CafeStaffAssignmentEntity).find({
      where: { userId: user.id },
      relations: { cafe: true },
      order: { cafeId: 'ASC' },
    });
    return assignments.map((assignment) => assignment.cafe);
  }

  async listWaiterCalls(user: AuthenticatedRequestUser, cafeId: string) {
    await this.assertCafeAccess(user, cafeId);
    return this.calls.find({
      where: { cafeId, status: WaiterCallStatus.OPEN },
      relations: { table: true },
      order: { createdAt: 'ASC' },
    });
  }

  async listCafeTables(user: AuthenticatedRequestUser, cafeId: string) {
    await this.assertCafeAccess(user, cafeId);
    return this.tables.find({
      where: { cafeId, isActive: true },
      order: { tableNumber: 'ASC' },
      select: { id: true, cafeId: true, tableNumber: true, capacity: true },
    });
  }

  async listPendingOrders(user: AuthenticatedRequestUser, cafeId: string) {
    await this.assertCafeAccess(user, cafeId);
    return this.orders.find({
      where: { cafeId, status: OrderStatus.PENDING_PAYMENT },
      relations: { items: true, cafeTable: true },
      order: { createdAt: 'ASC' },
    });
  }

  async resolveWaiterCall(user: AuthenticatedRequestUser, callId: string) {
    this.assertStaffRole(user);
    return this.dataSource.transaction(async (manager) => {
      const call = await manager
        .getRepository(WaiterCallEntity)
        .createQueryBuilder('call')
        .setLock('pessimistic_write')
        .where('call.id = :callId', { callId })
        .getOne();
      if (!call) throw new NotFoundException('Waiter call not found');
      await this.assertCafeAccess(user, call.cafeId, manager);
      call.status = WaiterCallStatus.RESOLVED;
      call.resolvedByUserId = user.id;
      call.resolvedAt = new Date();
      return manager.getRepository(WaiterCallEntity).save(call);
    });
  }

  async createAssistedOrder(
    user: AuthenticatedRequestUser,
    cafeId: string,
    tableId: string,
    dto: DiningOrderDto,
  ) {
    await this.assertCafeAccess(user, cafeId);
    const table = await this.tables.findOne({ where: { id: tableId, cafeId, isActive: true } });
    if (!table) throw new NotFoundException('Table not found in this café');
    return this.dataSource.transaction((manager) =>
      this.createDiningOrder(
        manager,
        cafeId,
        tableId,
        OrderFulfillmentType.ASSISTED_DINE_IN,
        dto,
        dto.requestId,
      ),
    );
  }

  async authorizeTableForPayment(tableCode: string, token: string | undefined): Promise<string> {
    const table = await this.authorizeTable(tableCode, token);
    return table.id;
  }

  async recordCashCollection(user: AuthenticatedRequestUser, orderId: string) {
    this.assertStaffRole(user);
    return this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(OrderEntity)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();
      if (!order) throw new NotFoundException('Order not found');
      await this.assertCafeAccess(user, order.cafeId!, manager);
      if (
        order.fulfillmentType !== OrderFulfillmentType.ASSISTED_DINE_IN ||
        order.status !== OrderStatus.PENDING_PAYMENT
      ) {
        throw new ConflictException('Only pending waiter-assisted orders can record cash collection');
      }
      const collection = await manager.getRepository(CashCollectionEntity).save(
        manager.getRepository(CashCollectionEntity).create({
          id: randomUUID(),
          orderId,
          collectedByUserId: user.id,
          amountPaise: order.totalPaise,
        }),
      );
      order.status = OrderStatus.CONFIRMED;
      if (order.stockReserved) await this.commitReservedStock(manager, orderId);
      order.stockReserved = false;
      await manager.getRepository(OrderEntity).save(order);
      return { order, cashCollection: collection, paymentMethod: 'cash_recorded_by_staff' };
    });
  }

  async updateOrderStatus(
    user: AuthenticatedRequestUser,
    orderId: string,
    status: 'preparing' | 'ready' | 'delivered',
  ) {
    this.assertStaffRole(user);
    return this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(OrderEntity)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();
      if (!order) throw new NotFoundException('Order not found');
      await this.assertCafeAccess(user, order.cafeId!, manager);
      const next = {
        [OrderStatus.CONFIRMED]: OrderStatus.PREPARING,
        [OrderStatus.PREPARING]: OrderStatus.READY,
        [OrderStatus.READY]: OrderStatus.DELIVERED,
      } as const;
      if (next[order.status as keyof typeof next] !== status) {
        throw new ConflictException('Invalid order status transition');
      }
      order.status = status as OrderStatus;
      return manager.getRepository(OrderEntity).save(order);
    });
  }

  async displayOrders(user: AuthenticatedRequestUser, cafeId: string) {
    await this.assertCafeAccess(user, cafeId);
    const orders = await this.orders
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('order.cafeTable', 'table')
      .where('order.cafeId = :cafeId', { cafeId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY],
      })
      .orderBy('order.orderNumber', 'ASC')
      .getMany();
    return orders.map((order) => ({
      orderNumber: order.orderNumber,
      tableNumber: order.cafeTable?.tableNumber ?? 'Assisted',
      status: order.status,
      items: order.items.map((item) => ({ name: item.productName, quantity: item.quantity })),
    }));
  }

  displayStream(user: AuthenticatedRequestUser, cafeId: string): Observable<{ data: unknown }> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(async () => ({ data: await this.displayOrders(user, cafeId) })),
    );
  }

  private async createDiningOrder(
    manager: EntityManager,
    cafeId: string,
    tableId: string,
    fulfillmentType: OrderFulfillmentType,
    dto: DiningOrderDto,
    requestId?: string,
  ) {
    const lockedTable = await manager
      .getRepository(CafeTableEntity)
      .createQueryBuilder('table')
      .setLock('pessimistic_write')
      .where('table.id = :tableId AND table.cafeId = :cafeId AND table.isActive = true', { tableId, cafeId })
      .getOne();
    if (!lockedTable) throw new NotFoundException('Table not found in this café');
    if (requestId) {
      const existing = await manager.getRepository(OrderEntity).findOne({
        where: { cafeTableId: tableId, clientRequestId: requestId },
      });
      if (existing) {
        return {
          id: existing.id,
          orderNumber: existing.orderNumber,
          status: existing.status,
          totalPaise: existing.totalPaise,
        };
      }
    }
    const quantities = new Map<string, number>();
    for (const item of dto.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    if ([...quantities.values()].some((quantity) => quantity > 20)) {
      throw new ConflictException('Requested quantity exceeds the table order limit');
    }

    const variantRepository = manager.getRepository(ProductVariantEntity);
    const locked: Array<{ variant: ProductVariantEntity; inventory: CafeInventoryEntity; quantity: number; unitPricePaise: number }> = [];
    for (const [variantId, quantity] of [...quantities].sort(([left], [right]) => left.localeCompare(right))) {
      const variant = await variantRepository
        .createQueryBuilder('variant')
        .innerJoinAndSelect('variant.product', 'product')
        .setLock('pessimistic_write')
        .where('variant.id = :variantId AND variant.isActive = true AND product.isActive = true', { variantId })
        .getOne();
      if (!variant) {
        throw new ConflictException('An item is no longer available in the requested quantity');
      }
      const availability = await manager.getRepository(ProductAvailabilityEntity).findOne({
        where: { variantId, channel: ProductChannel.CAFE, cafeId, isAvailable: true },
      });
      if (!availability) throw new ConflictException('An item is not available at this café');
      const inventoryRepository = manager.getRepository(CafeInventoryEntity);
      const inventory = await inventoryRepository.createQueryBuilder('inventory')
        .setLock('pessimistic_write')
        .where('inventory.cafeId = :cafeId AND inventory.variantId = :variantId', { cafeId, variantId })
        .getOne();
      if (!inventory || inventory.quantity - inventory.reservedQuantity < quantity) {
        throw new ConflictException('An item is no longer available in the requested quantity');
      }
      locked.push({ variant, inventory, quantity, unitPricePaise: availability.priceOverridePaise ?? variant.pricePaise });
    }

    const orderNumberRows = await manager.query(`SELECT nextval('cafe_order_number_seq') AS order_number`);
    const orderNumber = Number(orderNumberRows[0].order_number);
    const order = await manager.getRepository(OrderEntity).save(
      manager.getRepository(OrderEntity).create({
        id: randomUUID(),
        userId: null,
        fulfillmentType,
        status: OrderStatus.PENDING_PAYMENT,
        totalPaise: locked.reduce((total, entry) => total + entry.unitPricePaise * entry.quantity, 0),
        deliveryAddressSnapshot: {},
        stockReserved: true,
        paymentExpiresAt: new Date(Date.now() + 30 * 60_000),
        cafeId,
        cafeTableId: tableId,
        orderNumber,
        clientRequestId: requestId ?? null,
      }),
    );
    const items = locked.map(({ variant, inventory, quantity, unitPricePaise }) => {
      inventory.reservedQuantity += quantity;
      return manager.getRepository(OrderItemEntity).create({
        id: randomUUID(),
        orderId: order.id,
        productId: variant.productId,
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        quantity,
        unitPricePaise,
        lineTotalPaise: unitPricePaise * quantity,
      });
    });
    await manager.getRepository(CafeInventoryEntity).save(locked.map(({ inventory }) => inventory));
    await manager.getRepository(OrderItemEntity).save(items);
    return { id: order.id, orderNumber, status: order.status, totalPaise: order.totalPaise };
  }

  private async authorizeTable(tableCode: string, token: string | undefined): Promise<CafeTableEntity> {
    if (!token || token.length > 200) throw new UnauthorizedException('Table token required');
    const table = await this.tables.findOne({
      where: { tableCode, isActive: true },
      relations: { cafe: true },
    });
    if (!table) throw new NotFoundException('Table not found');
    const expected = Buffer.from(table.tokenHash, 'hex');
    const actual = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid table token');
    }
    return table;
  }

  private assertStaffRole(user: AuthenticatedRequestUser): void {
    if (![UserRole.ADMIN, UserRole.CAFE_MANAGER, UserRole.WAITER].includes(user.role)) {
      throw new ForbiddenException('Staff access required');
    }
  }

  private async assertCafeAccess(user: AuthenticatedRequestUser, cafeId: string, manager?: EntityManager) {
    this.assertStaffRole(user);
    if (user.role === UserRole.ADMIN) return;
    const assignments = (manager ?? this.dataSource.manager).getRepository(CafeStaffAssignmentEntity);
    const assignment = await assignments.findOne({ where: { cafeId, userId: user.id } });
    if (!assignment) throw new ForbiddenException('You are not assigned to this café');
  }

  private async commitReservedStock(manager: EntityManager, orderId: string): Promise<void> {
    const order = await manager.getRepository(OrderEntity).findOne({ where: { id: orderId }, relations: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    const inventoryRepository = manager.getRepository(CafeInventoryEntity);
    for (const item of order.items) {
      if (!item.variantId || !order.cafeId) continue;
      const inventory = await inventoryRepository
        .createQueryBuilder('inventory')
        .setLock('pessimistic_write')
        .where('inventory.cafeId = :cafeId AND inventory.variantId = :variantId', { cafeId: order.cafeId, variantId: item.variantId })
        .getOne();
      if (!inventory || inventory.reservedQuantity < item.quantity) throw new ConflictException('Reserved stock is inconsistent');
      inventory.reservedQuantity -= item.quantity;
      inventory.quantity -= item.quantity;
      await inventoryRepository.save(inventory);
    }
  }
}