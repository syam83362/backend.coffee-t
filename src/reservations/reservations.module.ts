import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CafeEntity } from '../database/entities/cafe.entity';
import { CafeReservationEntity } from '../database/entities/cafe-reservation.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([CafeReservationEntity, CafeEntity, CafeTableEntity])],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}