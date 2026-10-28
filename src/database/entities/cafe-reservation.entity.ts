import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CafeEntity } from './cafe.entity';
import { CafeTableEntity } from './cafe-table.entity';
import { UserEntity } from './user.entity';

export enum ReservationStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

@Entity({ name: 'cafe_reservations' })
@Index('ix_cafe_reservations_cafe_starts', ['cafeId', 'startsAt'])
@Index('ix_cafe_reservations_user_starts', ['userId', 'startsAt'])
export class CafeReservationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'cafe_id', type: 'uuid' })
  cafeId!: string;

  @ManyToOne(() => CafeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cafe_id' })
  cafe!: CafeEntity;

  @Column({ name: 'cafe_table_id', type: 'uuid' })
  cafeTableId!: string;

  @ManyToOne(() => CafeTableEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cafe_table_id' })
  table!: CafeTableEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'party_size', type: 'smallint' })
  partySize!: number;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  @Column({ type: 'enum', enum: ReservationStatus, enumName: 'reservation_status' })
  status!: ReservationStatus;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}