import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { ProductCategoryEntity } from './product-category.entity';
import { ProductVariantEntity } from './product-variant.entity';

export enum ProductDiscoveryStatus {
  CURRENT = 'current',
  NEW = 'new',
  UPCOMING = 'upcoming',
}

@Entity({ name: 'products' })
@Index('uq_products_slug', ['slug'], { unique: true })
@Index('ix_products_category_active', ['categoryId', 'isActive'])
export class ProductEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 180 })
  slug!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => ProductCategoryEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: ProductCategoryEntity;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'discovery_status', type: 'enum', enum: ProductDiscoveryStatus, enumName: 'product_discovery_status', default: ProductDiscoveryStatus.CURRENT })
  discoveryStatus!: ProductDiscoveryStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @OneToMany(() => ProductVariantEntity, (variant) => variant.product)
  variants!: ProductVariantEntity[];
}