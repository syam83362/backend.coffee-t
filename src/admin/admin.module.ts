import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { CafeEntity } from '../database/entities/cafe.entity';
import { CafeInventoryEntity } from '../database/entities/cafe-inventory.entity';
import { CafeStaffAssignmentEntity } from '../database/entities/cafe-staff-assignment.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { ProductAvailabilityEntity } from '../database/entities/product-availability.entity';
import { ProductCategoryEntity } from '../database/entities/product-category.entity';
import { ProductEntity } from '../database/entities/product.entity';
import { ProductVariantEntity } from '../database/entities/product-variant.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([AuditLogEntity, CafeEntity, CafeInventoryEntity, CafeStaffAssignmentEntity, CafeTableEntity, ProductAvailabilityEntity, ProductCategoryEntity, ProductEntity, ProductVariantEntity, UserEntity])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}