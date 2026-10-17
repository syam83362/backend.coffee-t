import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, Repository, DataSource, EntityManager } from 'typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import {
  ProductAvailabilityEntity,
  ProductChannel,
} from '../database/entities/product-availability.entity';
import { CartEntity } from '../database/entities/cart.entity';
import { CartItemEntity } from '../database/entities/cart-item.entity';
import { DeliveryAddressEntity } from '../database/entities/delivery-address.entity';
import {
  OrderEntity,
  OrderFulfillmentType,
  OrderStatus,
} from '../database/entities/order.entity';
import { OrderItemEntity } from '../database/entities/order-item.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { SetCartItemDto } from './dto/set-cart-item.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CartEntity)
    private readonly carts: Repository<CartEntity>,
    @InjectRepository(DeliveryAddressEntity)
    private readonly addresses: Repository<DeliveryAddressEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}

  async listAddresses(user: AuthenticatedRequestUser) {
    return this.addresses.find({ where: { userId: user.id }, order: { createdAt: 'DESC' } });
  }

  async createAddress(user: AuthenticatedRequestUser, dto: CreateAddressDto) {
    const address = this.addresses.create({
      id: randomUUID(),
      userId: user.id,
      recipientName: dto.recipientName.trim(),
      phone: dto.phone.trim(),
      line1: dto.line1.trim(),
      line2: dto.line2?.trim() || null,
      city: dto.city.trim(),
      state: dto.state.trim(),
      pincode: dto.pincode,
    });
    return this.addresses.save(address);
  }

  async getCart(user: AuthenticatedRequestUser) {
    const cart = await this.getOrCreateCart(user.id);
    const loaded = await this.carts.findOne({
      where: { id: cart.id },
      relations: { items: { variant: { product: true, availabilities: true } } },
    });
    return this.cartResponse(loaded ?? cart);
  }

  async setCartItem(
    user: AuthenticatedRequestUser,
    variantId: string,
    dto: SetCartItemDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const cart = await this.getLockedCart(manager, user.id);
      const variant = await this.getOnlineVariant(manager, variantId);
      if (!variant || variant.stockQuantity - variant.reservedQuantity < dto.quantity) {
        throw new ConflictException('This quantity is currently unavailable');
      }

      const items = manager.getRepository(CartItemEntity);
      const existing = await items.findOne({ where: { cartId: cart.id, variantId } });
      if (existing) {
        existing.quantity = dto.quantity;
        await items.save(existing);
      } else {
        await items.save(items.create({ id: randomUUID(), cartId: cart.id, variantId, quantity: dto.quantity }));
      }
      await manager.getRepository(CartEntity).update(cart.id, { updatedAt: new Date() });
      return this.getCartResponse(manager, cart.id);
    });
  }

  async addCartItem(
    user: AuthenticatedRequestUser,
    variantId: string,
    dto: SetCartItemDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const cart = await this.getLockedCart(manager, user.id);
      const variant = await this.getOnlineVariant(manager, variantId);
      const items = manager.getRepository(CartItemEntity);
      const existing = await items.findOne({ where: { cartId: cart.id, variantId } });
      const quantity = (existing?.quantity ?? 0) + dto.quantity;
      if (
        !variant ||
        quantity > 100 ||
        variant.stockQuantity - variant.reservedQuantity < quantity
      ) {
        throw new ConflictException('This quantity is currently unavailable');
      }

      if (existing) {
        existing.quantity = quantity;
        await items.save(existing);
      } else {
        await items.save(items.create({ id: randomUUID(), cartId: cart.id, variantId, quantity }));
      }
      await manager.getRepository(CartEntity).update(cart.id, { updatedAt: new Date() });
      return this.getCartResponse(manager, cart.id);
    });
  }

  async removeCartItem(user: AuthenticatedRequestUser, variantId: string): Promise<void> {
    const cart = await this.getOrCreateCart(user.id);
    await this.dataSource.getRepository(CartItemEntity).delete({ cartId: cart.id, variantId });
  }

  async checkout(user: AuthenticatedRequestUser, addressId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Online checkout is unavailable until a production payment provider is configured');
    }
    return this.dataSource.transaction(async (manager) => {
      const cart = await manager
        .getRepository(CartEntity)
        .createQueryBuilder('cart')
        .setLock('pessimistic_write')
        .where('cart.userId = :userId', { userId: user.id })
        .getOne();
      if (!cart) throw new ConflictException('Your cart is empty');

      const address = await manager.getRepository(DeliveryAddressEntity).findOne({
        where: { id: addressId, userId: user.id },
      });
      if (!address) throw new NotFoundException('Delivery address not found');

      const cartItems = await manager.getRepository(CartItemEntity).find({
        where: { cartId: cart.id },
        order: { variantId: 'ASC' },
      });
      if (!cartItems.length) throw new ConflictException('Your cart is empty');

      const locked: Array<{ cartItem: CartItemEntity; variant: ProductVariantEntity }> = [];
      for (const cartItem of cartItems) {
        const variant = await this.getOnlineVariant(manager, cartItem.variantId, true);
        if (!variant || variant.stockQuantity - variant.reservedQuantity < cartItem.quantity) {
          throw new ConflictException('An item in your cart is no longer available in that quantity');
        }
        locked.push({ cartItem, variant });
      }

      const totalPaise = locked.reduce(
        (total, entry) => total + entry.variant.pricePaise * entry.cartItem.quantity,
        0,
      );
      if (!Number.isSafeInteger(totalPaise)) {
        throw new ConflictException('Order total exceeds the supported amount');
      }

      const order = await manager.getRepository(OrderEntity).save(
        manager.getRepository(OrderEntity).create({
          id: randomUUID(),
          userId: user.id,
          fulfillmentType: OrderFulfillmentType.DELIVERY,
          status: OrderStatus.PENDING_PAYMENT,
          totalPaise,
          deliveryAddressSnapshot: {
            recipientName: address.recipientName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
          },
          paymentExpiresAt: new Date(Date.now() + 30 * 60_000),
        }),
      );

      await manager.getRepository(OrderItemEntity).save(
        locked.map(({ cartItem, variant }) => {
          variant.reservedQuantity += cartItem.quantity;
          return manager.getRepository(OrderItemEntity).create({
            id: randomUUID(),
            orderId: order.id,
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            variantName: variant.name,
            sku: variant.sku,
            quantity: cartItem.quantity,
            unitPricePaise: variant.pricePaise,
            lineTotalPaise: variant.pricePaise * cartItem.quantity,
          });
        }),
      );
      await manager.getRepository(ProductVariantEntity).save(locked.map(({ variant }) => variant));
      await manager.getRepository(CartItemEntity).delete({ cartId: cart.id });

      return this.orders.findOne({ where: { id: order.id }, relations: { items: true } });
    });
  }

  async listOrders(user: AuthenticatedRequestUser) {
    return this.orders.find({
      where: { userId: user.id },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrder(user: AuthenticatedRequestUser, orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, userId: user.id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async getOrCreateCart(userId: string, manager?: EntityManager): Promise<CartEntity> {
    const repository = (manager ?? this.dataSource.manager).getRepository(CartEntity);
    const cart = await repository.findOne({ where: { userId } });
    if (cart) return cart;
    await repository.createQueryBuilder()
      .insert()
      .values({ id: randomUUID(), userId })
      .orIgnore()
      .execute();
    const created = await repository.findOne({ where: { userId } });
    if (!created) throw new ConflictException('Could not initialize cart');
    return created;
  }

  private async getLockedCart(manager: EntityManager, userId: string): Promise<CartEntity> {
    await this.getOrCreateCart(userId, manager);
    const cart = await manager.getRepository(CartEntity)
      .createQueryBuilder('cart')
      .setLock('pessimistic_write')
      .where('cart.userId = :userId', { userId })
      .getOne();
    if (!cart) throw new ConflictException('Could not initialize cart');
    return cart;
  }

  private async getOnlineVariant(
    manager: EntityManager,
    variantId: string,
    lock = false,
  ): Promise<ProductVariantEntity | null> {
    const builder = manager
      .getRepository(ProductVariantEntity)
      .createQueryBuilder('variant')
      .innerJoinAndSelect('variant.product', 'product')
      .where('variant.id = :variantId', { variantId })
      .andWhere('variant.isActive = true')
      .andWhere('product.isActive = true');
    if (lock) builder.setLock('pessimistic_write');
    const variant = await builder.getOne();
    if (!variant) return null;

    const availability = await manager.getRepository(ProductAvailabilityEntity).findOne({
      where: { variantId, channel: ProductChannel.ONLINE, cafeId: IsNull(), isAvailable: true },
    });
    return availability ? variant : null;
  }

  private async getCartResponse(manager: EntityManager, cartId: string) {
    const cart = await manager.getRepository(CartEntity).findOne({
      where: { id: cartId },
      relations: { items: { variant: { product: true, availabilities: true } } },
    });
    return this.cartResponse(cart ?? { id: cartId, items: [] });
  }

  private cartResponse(cart: Pick<CartEntity, 'id' | 'items'>) {
    const items = (cart.items ?? []).map((item) => {
      const variant = item.variant;
      const onlineAvailability = variant?.availabilities?.some(
        (availability) =>
          availability.channel === ProductChannel.ONLINE &&
          availability.cafeId === null &&
          availability.isAvailable,
      );
      return {
        variantId: item.variantId,
        productName: variant?.product?.name ?? 'Unavailable product',
        variantName: variant?.name ?? 'Unavailable option',
        quantity: item.quantity,
        unitPricePaise: variant?.pricePaise ?? 0,
        lineTotalPaise: (variant?.pricePaise ?? 0) * item.quantity,
        available: Boolean(variant?.isActive && onlineAvailability),
      };
    });
    return {
      id: cart.id,
      items,
      totalPaise: items.reduce((total, item) => total + item.lineTotalPaise, 0),
    };
  }
}