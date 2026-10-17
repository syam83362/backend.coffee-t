import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PaymentAttemptEntity } from './payment-attempt.entity';

@Entity({ name: 'payment_events' })
@Index('uq_payment_event_provider_id', ['providerEventId'], { unique: true })
@Index('ix_payment_event_attempt_received', ['attemptId', 'receivedAt'])
export class PaymentEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId!: string;

  @ManyToOne(() => PaymentAttemptEntity, (attempt) => attempt.events, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'attempt_id' })
  attempt!: PaymentAttemptEntity;

  @Column({ name: 'provider_event_id', type: 'varchar', length: 180 })
  providerEventId!: string;

  @Column({ type: 'varchar', length: 80 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  details!: Record<string, string>;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt!: Date;
}