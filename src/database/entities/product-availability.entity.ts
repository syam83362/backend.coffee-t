import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CafeEntity } from './cafe.entity';
import { ProductVariantEntity } from './product-variant.entity';

export enum ProductChannel {
  ONLINE = 'online',
  CAFE = 'cafe',
}

@Entity({ name: 'product_availability' })
@Index('uq_product_availability_online', ['variantId'], {
  unique: true,
  where: '"channel" = \'online\'',
})
@Index('uq_product_availability_cafe', ['variantId', 'cafeId'], {
  unique: true,
  where: '"channel" = \'cafe\'',
})
export class ProductAvailabilityEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @ManyToOne(() => ProductVariantEntity, (variant) => variant.availabilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariantEntity;

  @Column({ type: 'enum', enum: ProductChannel, enumName: 'product_channel' })
  channel!: ProductChannel;

  @Column({ name: 'cafe_id', type: 'uuid', nullable: true })
  cafeId!: string | null;

  @ManyToOne(() => CafeEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'cafe_id' })
  cafe!: CafeEntity | null;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ name: 'price_override_paise', type: 'integer', nullable: true })
  priceOverridePaise!: number | null;
}