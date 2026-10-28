import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import {
  ProductAvailabilityEntity,
  ProductChannel,
} from '../database/entities/product-availability.entity';
import { CartEntity } from '../database/entities/cart.entity';
import { CartItemEntity } from '../database/entities/cart-item.entity';
import { DeliveryAddressEntity } from '../database/entities/delivery-address.entity';
import { OrderEntity, OrderStatus } from '../database/entities/order.entity';
import { OrderItemEntity } from '../database/entities/order-item.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { OrdersService } from './orders.service';

const customer = { id: 'customer-id', role: 'customer' } as AuthenticatedRequestUser;

describe('OrdersService', () => {
  it('creates a pending order from server prices and reserves stock', async () => {
    const cart = { id: 'cart-id' };
    const cartItem = { id: 'cart-item-id', cartId: cart.id, variantId: 'variant-id', quantity: 2 };
    const variant = {
      id: 'variant-id',
      productId: 'product-id',
      product: { name: 'Monsoon Malabar', isActive: true },
      name: 'Whole bean, 250 g',
      sku: 'CT-COF-MAL-250',
      pricePaise: 64900,
      stockQuantity: 10,
      reservedQuantity: 1,
      isActive: true,
    };
    const address = {
      id: 'address-id',
      userId: customer.id,
      recipientName: 'A Customer',
      phone: '9876543210',
      line1: '12 Market Road',
      line2: null,
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
    };
    const orderRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: OrderStatus.PENDING_PAYMENT,
        totalPaise: 129800,
      })),
      find: jest.fn(),
    };
    const variantQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(variant),
    };
    const variantRepository = {
      createQueryBuilder: jest.fn(() => variantQuery),
      save: jest.fn(async (values) => values),
    };
    const orderItemRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (values) => values),
    };
    const cartQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(cart),
    };
    const cartRepository = { createQueryBuilder: jest.fn(() => cartQuery) };
    const cartItemRepository = {
      find: jest.fn().mockResolvedValue([cartItem]),
      delete: jest.fn(),
    };
    const addressRepository = { findOne: jest.fn().mockResolvedValue(address) };
    const availabilityRepository = {
      findOne: jest.fn().mockResolvedValue({ channel: ProductChannel.ONLINE }),
    };
    const repositories = new Map<Function, unknown>([
      [CartEntity, cartRepository],
      [CartItemEntity, cartItemRepository],
      [DeliveryAddressEntity, addressRepository],
      [OrderEntity, orderRepository],
      [OrderItemEntity, orderItemRepository],
      [ProductAvailabilityEntity, availabilityRepository],
      [ProductVariantEntity, variantRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity: Function) => repositories.get(entity)),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (transactionManager: typeof manager) => unknown) =>
        callback(manager)),
    };
    const service = new OrdersService(
      dataSource as never,
      {} as Repository<CartEntity>,
      {} as Repository<DeliveryAddressEntity>,
      orderRepository as unknown as Repository<OrderEntity>,
    );

    const result = await service.checkout(customer, address.id);

    expect(result).toMatchObject({ status: OrderStatus.PENDING_PAYMENT, totalPaise: 129800 });
    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrderStatus.PENDING_PAYMENT,
        totalPaise: 129800,
        fulfillmentType: 'delivery',
      }),
    );
    expect(orderItemRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPricePaise: 64900, lineTotalPaise: 129800, quantity: 2 }),
    );
    expect(variant.reservedQuantity).toBe(3);
    expect(variantRepository.save).toHaveBeenCalledWith([variant]);
    expect(cartItemRepository.delete).toHaveBeenCalledWith({ cartId: cart.id });
  });

  it('does not expose an order to a different customer', async () => {
    const orderRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<OrderEntity>;
    const service = new OrdersService(
      {} as never,
      {} as Repository<CartEntity>,
      {} as Repository<DeliveryAddressEntity>,
      orderRepository,
    );

    await expect(service.getOrder(customer, 'someone-elses-order')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(orderRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'someone-elses-order', userId: customer.id } }),
    );
  });
});