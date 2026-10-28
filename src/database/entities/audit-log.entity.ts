import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CafeEntity } from './cafe.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'audit_logs' })
@Index('ix_audit_logs_cafe_created', ['cafeId', 'createdAt'])
@Index('ix_audit_logs_actor_created', ['actorUserId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actor!: UserEntity | null;

  @Column({ name: 'cafe_id', type: 'uuid', nullable: true })
  cafeId!: string | null;

  @ManyToOne(() => CafeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cafe_id' })
  cafe!: CafeEntity | null;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ name: 'target_type', type: 'varchar', length: 80 })
  targetType!: string;

  @Column({ name: 'target_id', type: 'varchar', length: 100 })
  targetId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  changes!: Record<string, string | number | boolean | null>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}