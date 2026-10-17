import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'product_categories' })
@Index('uq_product_categories_slug', ['slug'], { unique: true })
export class ProductCategoryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'display_order', type: 'smallint', default: 0 })
  displayOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}