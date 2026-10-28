import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProductAvailabilityEntity } from '../database/entities/product-availability.entity';
import { CartEntity } from '../database/entities/cart.entity';
import { CartItemEntity } from '../database/entities/cart-item.entity';
import { DeliveryAddressEntity } from '../database/entities/delivery-address.entity';
import { OrderEntity } from '../database/entities/order.entity';
import { OrderItemEntity } from '../database/entities/order-item.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ProductAvailabilityEntity,
      CartEntity,
      CartItemEntity,
      DeliveryAddressEntity,
      OrderEntity,
      OrderItemEntity,
      ProductVariantEntity,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}