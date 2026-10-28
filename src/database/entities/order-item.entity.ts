import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { OrderEntity } from './order.entity';
import { ProductEntity } from './product.entity';
import { ProductVariantEntity } from './product-variant.entity';

@Entity({ name: 'order_items' })
export class OrderItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId!: string | null;

  @ManyToOne(() => ProductEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity | null;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId!: string | null;

  @ManyToOne(() => ProductVariantEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariantEntity | null;

  @Column({ name: 'product_name', type: 'varchar', length: 160 })
  productName!: string;

  @Column({ name: 'variant_name', type: 'varchar', length: 100 })
  variantName!: string;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'smallint' })
  quantity!: number;

  @Column({ name: 'unit_price_paise', type: 'integer' })
  unitPricePaise!: number;

  @Column({ name: 'line_total_paise', type: 'integer' })
  lineTotalPaise!: number;
}