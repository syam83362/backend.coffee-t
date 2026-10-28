import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { CafeTableEntity } from './cafe-table.entity';

export enum WaiterCallStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

@Entity({ name: 'waiter_calls' })
@Index('ix_waiter_calls_cafe_status_created', ['cafeId', 'status', 'createdAt'])
export class WaiterCallEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'cafe_id', type: 'uuid' })
  cafeId!: string;

  @Column({ name: 'cafe_table_id', type: 'uuid' })
  cafeTableId!: string;

  @ManyToOne(() => CafeTableEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cafe_table_id' })
  table!: CafeTableEntity;

  @Column({ type: 'enum', enum: WaiterCallStatus, enumName: 'waiter_call_status' })
  status!: WaiterCallStatus;

  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedBy!: UserEntity | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}