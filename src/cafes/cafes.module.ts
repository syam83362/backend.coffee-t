import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CafeEntity } from '../database/entities/cafe.entity';
import { CafeStaffAssignmentEntity } from '../database/entities/cafe-staff-assignment.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { CafeInventoryEntity } from '../database/entities/cafe-inventory.entity';
import { CashCollectionEntity } from '../database/entities/cash-collection.entity';
import { OrderEntity } from '../database/entities/order.entity';
import { OrderItemEntity } from '../database/entities/order-item.entity';
import { ProductAvailabilityEntity } from '../database/entities/product-availability.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { WaiterCallEntity } from '../database/entities/waiter-call.entity';
import { CafesController } from './cafes.controller';
import { CafesService } from './cafes.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      CafeEntity,
      CafeStaffAssignmentEntity,
      CafeTableEntity,
      CafeInventoryEntity,
      CashCollectionEntity,
      OrderEntity,
      OrderItemEntity,
      ProductAvailabilityEntity,
      ProductVariantEntity,
      WaiterCallEntity,
    ]),
  ],
  controllers: [CafesController],
  providers: [CafesService],
})
export class CafesModule {}