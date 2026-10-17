import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { ProductAvailabilityEntity, ProductChannel } from '../database/entities/product-availability.entity';
import { OrderEntity, OrderStatus } from '../database/entities/order.entity';
import {
  PaymentAttemptEntity,
  PaymentAttemptStatus,
  PaymentProvider,
} from '../database/entities/payment-attempt.entity';
import { PaymentEventEntity } from '../database/entities/payment-event.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { CafeEntity, CafeStatus } from '../database/entities/cafe.entity';
import { CafeInventoryEntity } from '../database/entities/cafe-inventory.entity';

@Injectable()
export class PaymentsService {
  constructor(private readonly dataSource: DataSource) {}

  async start(user: AuthenticatedRequestUser, orderId: string, idempotencyKey: string) {
    return this.startForOrder(orderId, idempotencyKey, { userId: user.id });
  }

  async startForTable(
    tableCode: string,
    token: string | undefined,
    orderId: string,
    idempotencyKey: string,
  ) {
    const tableId = await this.getAuthorizedTableId(tableCode, token);
    return this.startForOrder(orderId, idempotencyKey, { tableId });
  }

  private async startForOrder(
    orderId: string,
    idempotencyKey: string,
    owner: { userId: string } | { tableId: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('No production payment provider is configured');
    }
    return this.dataSource.transaction(async (manager) => {
      const builder = manager.getRepository(OrderEntity).createQueryBuilder('order').setLock('pessimistic_write');
      if ('userId' in owner) {
        builder.where('order.id = :orderId AND order.userId = :userId', { orderId, userId: owner.userId });
      } else {
        builder.where('order.id = :orderId AND order.cafeTableId = :tableId AND order.userId IS NULL', {
          orderId,
          tableId: owner.tableId,
        });
      }
      const order = await builder.getOne();
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('This order is not awaiting payment');
      }
      if (order.paymentExpiresAt.getTime() <= Date.now()) {
        throw new ConflictException('The payment window for this order has expired');
      }

      const attempts = manager.getRepository(PaymentAttemptEntity);
      const existing = await attempts.findOne({ where: { orderId, idempotencyKey } });
      if (existing) return this.toResponse(existing);
      const pending = await attempts.findOne({
        where: { orderId, status: PaymentAttemptStatus.PENDING },
      });
      if (pending) throw new ConflictException('A payment attempt is already pending');

      if (!order.stockReserved) {
        await this.reserveStock(manager, orderId);
        order.stockReserved = true;
        await manager.getRepository(OrderEntity).save(order);
      }

      const attempt = await attempts.save(
        attempts.create({
          id: randomUUID(),
          orderId,
          provider: PaymentProvider.DEVELOPMENT,
          status: PaymentAttemptStatus.PENDING,
          amountPaise: order.totalPaise,
          idempotencyKey,
          providerReference: null,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        }),
      );
      return this.toResponse(attempt);
    });
  }

  async resolveDevelopment(
    user: AuthenticatedRequestUser,
    attemptId: string,
    outcome: 'success' | 'failure',
  ) {
    return this.resolveDevelopmentForOwner(attemptId, outcome, { userId: user.id });
  }

  async resolveDevelopmentForTable(
    tableCode: string,
    token: string | undefined,
    attemptId: string,
    outcome: 'success' | 'failure',
  ) {
    const tableId = await this.getAuthorizedTableId(tableCode, token);
    return this.resolveDevelopmentForOwner(attemptId, outcome, { tableId });
  }

  private async resolveDevelopmentForOwner(
    attemptId: string,
    outcome: 'success' | 'failure',
    owner: { userId: string } | { tableId: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Development payment simulation is disabled in production');
    }
    return this.dataSource.transaction(async (manager) => {
      const builder = manager
        .getRepository(PaymentAttemptEntity)
        .createQueryBuilder('attempt')
        .innerJoinAndSelect('attempt.order', 'order')
        .setLock('pessimistic_write');
      if ('userId' in owner) {
        builder.where('attempt.id = :attemptId AND order.userId = :userId', {
          attemptId,
          userId: owner.userId,
        });
      } else {
        builder.where('attempt.id = :attemptId AND order.cafeTableId = :tableId AND order.userId IS NULL', {
          attemptId,
          tableId: owner.tableId,
        });
      }
      const attempt = await builder.getOne();
      if (!attempt) throw new NotFoundException('Payment attempt not found');

      const providerEventId = `dev-${attempt.id}-${outcome}`;
      const eventRepository = manager.getRepository(PaymentEventEntity);
      const duplicate = await eventRepository.findOne({ where: { providerEventId } });
      if (duplicate) return this.toResponse(attempt);
      if (attempt.status !== PaymentAttemptStatus.PENDING) {
        throw new ConflictException('Payment attempt is already resolved');
      }

      const order = await manager
        .getRepository(OrderEntity)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId: attempt.orderId })
        .getOne();
      if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Order is not awaiting payment');
      }
      if (attempt.amountPaise !== order.totalPaise) {
        throw new ConflictException('Payment amount does not match order total');
      }

      await eventRepository.save(
        eventRepository.create({
          id: randomUUID(),
          attemptId: attempt.id,
          providerEventId,
          eventType: outcome === 'success' ? 'development.success' : 'development.failure',
          details: { outcome, amountPaise: String(attempt.amountPaise) },
        }),
      );

      if (outcome === 'success') {
        attempt.status = PaymentAttemptStatus.SUCCEEDED;
        order.status = OrderStatus.CONFIRMED;
        if (order.stockReserved) await this.commitReservedStock(manager, order.id);
      } else {
        attempt.status = PaymentAttemptStatus.FAILED;
        if (order.stockReserved) await this.releaseReservedStock(manager, order.id);
      }
      order.stockReserved = false;
      await manager.getRepository(PaymentAttemptEntity).save(attempt);
      await manager.getRepository(OrderEntity).save(order);
      return this.toResponse(attempt);
    });
  }

  async listForOrder(user: AuthenticatedRequestUser, orderId: string) {
    const order = await this.dataSource.getRepository(OrderEntity).findOne({
      where: { id: orderId, userId: user.id },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.dataSource.getRepository(PaymentAttemptEntity).find({
      where: { orderId },
      relations: { events: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async reserveStock(manager: EntityManager, orderId: string): Promise<void> {
    const order = await manager.getRepository(OrderEntity).findOne({
      where: { id: orderId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const variants = manager.getRepository(ProductVariantEntity);
    for (const item of [...order.items].sort((left, right) => left.variantId!.localeCompare(right.variantId!))) {
      if (!item.variantId) throw new ConflictException('An item is no longer available');
      if (order.cafeId) {
        const inventoryRepository = manager.getRepository(CafeInventoryEntity);
        const inventory = await inventoryRepository.createQueryBuilder('inventory')
          .setLock('pessimistic_write')
          .where('inventory.cafeId = :cafeId AND inventory.variantId = :variantId', { cafeId: order.cafeId, variantId: item.variantId })
          .getOne();
        const availability = await manager.getRepository(ProductAvailabilityEntity).findOne({
          where: { variantId: item.variantId, channel: ProductChannel.CAFE, cafeId: order.cafeId, isAvailable: true },
        });
        if (!inventory || !availability || inventory.quantity - inventory.reservedQuantity < item.quantity) {
          throw new ConflictException('An item is no longer available at this café');
        }
        inventory.reservedQuantity += item.quantity;
        await inventoryRepository.save(inventory);
        continue;
      }
      const variant = await variants
        .createQueryBuilder('variant')
        .setLock('pessimistic_write')
        .where('variant.id = :variantId', { variantId: item.variantId })
        .getOne();
      if (!variant || variant.stockQuantity - variant.reservedQuantity < item.quantity) {
        throw new ConflictException('An item is no longer available in the requested quantity');
      }
      const availability = await manager.getRepository(ProductAvailabilityEntity).findOne({
        where: {
          variantId: item.variantId,
          channel: ProductChannel.ONLINE,
          cafeId: IsNull(),
          isAvailable: true,
        },
      });
      if (!availability) throw new ConflictException('An item is no longer available online');
      variant.reservedQuantity += item.quantity;
      await variants.save(variant);
    }
  }

  async releaseReservedStock(manager: EntityManager, orderId: string): Promise<void> {
    await this.updateStockReservations(manager, orderId, false);
  }

  private async commitReservedStock(manager: EntityManager, orderId: string): Promise<void> {
    await this.updateStockReservations(manager, orderId, true);
  }

  private async updateStockReservations(
    manager: EntityManager,
    orderId: string,
    commit: boolean,
  ): Promise<void> {
    const order = await manager.getRepository(OrderEntity).findOne({
      where: { id: orderId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const variants = manager.getRepository(ProductVariantEntity);
    for (const item of [...order.items].sort((left, right) => left.variantId!.localeCompare(right.variantId!))) {
      if (!item.variantId) continue;
      if (order.cafeId) {
        const inventoryRepository = manager.getRepository(CafeInventoryEntity);
        const inventory = await inventoryRepository.createQueryBuilder('inventory')
          .setLock('pessimistic_write')
          .where('inventory.cafeId = :cafeId AND inventory.variantId = :variantId', { cafeId: order.cafeId, variantId: item.variantId })
          .getOne();
        if (!inventory || inventory.reservedQuantity < item.quantity) {
          throw new ConflictException('Reserved café stock is inconsistent');
        }
        inventory.reservedQuantity -= item.quantity;
        if (commit) inventory.quantity -= item.quantity;
        await inventoryRepository.save(inventory);
        continue;
      }
      const variant = await variants
        .createQueryBuilder('variant')
        .setLock('pessimistic_write')
        .where('variant.id = :variantId', { variantId: item.variantId })
        .getOne();
      if (!variant || variant.reservedQuantity < item.quantity) {
        throw new ConflictException('Reserved stock is inconsistent');
      }
      variant.reservedQuantity -= item.quantity;
      if (commit) variant.stockQuantity -= item.quantity;
      await variants.save(variant);
    }
  }

  private toResponse(attempt: PaymentAttemptEntity) {
    return {
      id: attempt.id,
      orderId: attempt.orderId,
      provider: attempt.provider,
      status: attempt.status,
      amountPaise: attempt.amountPaise,
      developmentSimulationAvailable:
        process.env.NODE_ENV !== 'production' && attempt.status === PaymentAttemptStatus.PENDING,
    };
  }

  private async getAuthorizedTableId(tableCode: string, token: string | undefined): Promise<string> {
    if (!token || token.length > 200) throw new NotFoundException('Table session is not valid');
    const table = await this.dataSource.getRepository(CafeTableEntity).findOne({
      where: { tableCode, isActive: true },
      relations: { cafe: true },
    });
    if (!table || table.cafe.status !== CafeStatus.ACTIVE) {
      throw new NotFoundException('Table session is not valid');
    }
    const expected = Buffer.from(table.tokenHash, 'hex');
    const actual = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new NotFoundException('Table session is not valid');
    }
    return table.id;
  }
}