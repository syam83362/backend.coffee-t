import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CafeInventoryEntity } from '../database/entities/cafe-inventory.entity';
import { PaymentExpirationService } from './payment-expiration.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([CafeInventoryEntity])],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentExpirationService],
})
export class PaymentsModule {}