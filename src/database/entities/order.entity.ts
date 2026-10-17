import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { OrderItemEntity } from './order-item.entity';
import { CafeTableEntity } from './cafe-table.entity';

export enum OrderFulfillmentType {
  DELIVERY = 'delivery',
  DINE_IN = 'dine_in',
  ASSISTED_DINE_IN = 'assisted_dine_in',
}

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity({ name: 'orders' })
@Index('ix_orders_user_created', ['userId', 'createdAt'])
@Index('uq_orders_table_request', ['cafeTableId', 'clientRequestId'], {
  unique: true,
  where: '"client_request_id" IS NOT NULL',
})
export class OrderEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity | null;

  @Column({ name: 'fulfillment_type', type: 'enum', enum: OrderFulfillmentType, enumName: 'order_fulfillment_type' })
  fulfillmentType!: OrderFulfillmentType;

  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status' })
  status!: OrderStatus;

  @Column({ name: 'total_paise', type: 'integer' })
  totalPaise!: number;

  @Column({ name: 'stock_reserved', type: 'boolean', default: true })
  stockReserved!: boolean;

  @Column({ name: 'payment_expires_at', type: 'timestamptz' })
  paymentExpiresAt!: Date;

  @Column({ name: 'cafe_id', type: 'uuid', nullable: true })
  cafeId!: string | null;

  @Column({ name: 'cafe_table_id', type: 'uuid', nullable: true })
  cafeTableId!: string | null;

  @ManyToOne(() => CafeTableEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'cafe_table_id' })
  cafeTable!: CafeTableEntity | null;

  @Column({ name: 'order_number', type: 'integer', nullable: true })
  orderNumber!: number | null;

  @Column({ name: 'client_request_id', type: 'uuid', nullable: true })
  clientRequestId!: string | null;

  @Column({ name: 'delivery_address_snapshot', type: 'jsonb' })
  deliveryAddressSnapshot!: Record<string, string | null>;

  @OneToMany(() => OrderItemEntity, (item) => item.order, { cascade: ['insert'] })
  items!: OrderItemEntity[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}