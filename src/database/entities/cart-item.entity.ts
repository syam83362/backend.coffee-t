import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CartEntity } from './cart.entity';
import { ProductVariantEntity } from './product-variant.entity';

@Entity({ name: 'cart_items' })
@Index('uq_cart_items_cart_variant', ['cartId', 'variantId'], { unique: true })
export class CartItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'cart_id', type: 'uuid' })
  cartId!: string;

  @ManyToOne(() => CartEntity, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart!: CartEntity;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @ManyToOne(() => ProductVariantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariantEntity;

  @Column({ type: 'smallint' })
  quantity!: number;
}