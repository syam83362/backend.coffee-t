import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CafeEntity } from './cafe.entity';
import { ProductVariantEntity } from './product-variant.entity';

@Entity({ name: 'cafe_inventory' })
@Index('uq_cafe_inventory_cafe_variant', ['cafeId', 'variantId'], { unique: true })
export class CafeInventoryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'cafe_id', type: 'uuid' })
  cafeId!: string;

  @ManyToOne(() => CafeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cafe_id' })
  cafe!: CafeEntity;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @ManyToOne(() => ProductVariantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariantEntity;

  @Column({ type: 'integer', default: 0 })
  quantity!: number;

  @Column({ name: 'reserved_quantity', type: 'integer', default: 0 })
  reservedQuantity!: number;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}