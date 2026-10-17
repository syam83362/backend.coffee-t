import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { OrderEntity } from './order.entity';
import { PaymentEventEntity } from './payment-event.entity';

export enum PaymentProvider {
  DEVELOPMENT = 'development',
}

export enum PaymentAttemptStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity({ name: 'payment_attempts' })
@Index('uq_payment_attempt_idempotency', ['orderId', 'idempotencyKey'], { unique: true })
@Index('ix_payment_attempt_order_created', ['orderId', 'createdAt'])
export class PaymentAttemptEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => OrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;

  @Column({ type: 'enum', enum: PaymentProvider, enumName: 'payment_provider' })
  provider!: PaymentProvider;

  @Column({ type: 'enum', enum: PaymentAttemptStatus, enumName: 'payment_attempt_status' })
  status!: PaymentAttemptStatus;

  @Column({ name: 'amount_paise', type: 'integer' })
  amountPaise!: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey!: string;

  @Column({ name: 'provider_reference', type: 'varchar', length: 160, nullable: true })
  providerReference!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @OneToMany(() => PaymentEventEntity, (event) => event.attempt)
  events!: PaymentEventEntity[];
}