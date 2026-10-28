import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { ProductAvailabilityEntity } from './product-availability.entity';
import { ProductEntity } from './product.entity';

@Entity({ name: 'product_variants' })
@Index('uq_product_variants_sku', ['sku'], { unique: true })
@Index('ix_product_variants_product_active', ['productId', 'isActive'])
export class ProductVariantEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => ProductEntity, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'price_paise', type: 'integer' })
  pricePaise!: number;

  @Column({ name: 'stock_quantity', type: 'integer', default: 0 })
  stockQuantity!: number;

  @Column({ name: 'reserved_quantity', type: 'integer', default: 0 })
  reservedQuantity!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => ProductAvailabilityEntity, (availability) => availability.variant)
  availabilities!: ProductAvailabilityEntity[];
}