import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { OrderEntity } from './order.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'cash_collections' })
export class CashCollectionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid', unique: true })
  orderId!: string;

  @OneToOne(() => OrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;

  @Column({ name: 'collected_by_user_id', type: 'uuid' })
  collectedByUserId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'collected_by_user_id' })
  collectedBy!: UserEntity;

  @Column({ name: 'amount_paise', type: 'integer' })
  amountPaise!: number;

  @Column({ name: 'collected_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  collectedAt!: Date;
}