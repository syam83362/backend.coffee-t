import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { validateEnvironment } from './config/validate-environment';
import { UserEntity } from './database/entities/user.entity';
import { RefreshSessionEntity } from './database/entities/refresh-session.entity';
import { CafeEntity } from './database/entities/cafe.entity';
import { ProductAvailabilityEntity } from './database/entities/product-availability.entity';
import { ProductCategoryEntity } from './database/entities/product-category.entity';
import { ProductEntity } from './database/entities/product.entity';
import { ProductVariantEntity } from './database/entities/product-variant.entity';
import { CartEntity } from './database/entities/cart.entity';
import { CartItemEntity } from './database/entities/cart-item.entity';
import { DeliveryAddressEntity } from './database/entities/delivery-address.entity';
import { OrderEntity } from './database/entities/order.entity';
import { OrderItemEntity } from './database/entities/order-item.entity';
import { PaymentAttemptEntity } from './database/entities/payment-attempt.entity';
import { PaymentEventEntity } from './database/entities/payment-event.entity';
import { CafeTableEntity } from './database/entities/cafe-table.entity';
import { CafeStaffAssignmentEntity } from './database/entities/cafe-staff-assignment.entity';
import { CashCollectionEntity } from './database/entities/cash-collection.entity';
import { WaiterCallEntity } from './database/entities/waiter-call.entity';
import { CafeReservationEntity } from './database/entities/cafe-reservation.entity';
import { CafeInventoryEntity } from './database/entities/cafe-inventory.entity';
import { AuditLogEntity } from './database/entities/audit-log.entity';
import { PaymentsModule } from './payments/payments.module';
import { CafesModule } from './cafes/cafes.module';
import { ReservationsModule } from './reservations/reservations.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [
          UserEntity,
          RefreshSessionEntity,
          CafeEntity,
          ProductAvailabilityEntity,
          ProductCategoryEntity,
          ProductEntity,
          ProductVariantEntity,
          CartEntity,
          CartItemEntity,
          DeliveryAddressEntity,
          OrderEntity,
          OrderItemEntity,
          PaymentAttemptEntity,
          PaymentEventEntity,
          CafeTableEntity,
          CafeStaffAssignmentEntity,
          CashCollectionEntity,
          WaiterCallEntity,
          CafeReservationEntity,
          CafeInventoryEntity,
          AuditLogEntity,
        ],
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    AuthModule,
    HealthModule,
    CatalogueModule,
    OrdersModule,
    PaymentsModule,
    CafesModule,
    ReservationsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}