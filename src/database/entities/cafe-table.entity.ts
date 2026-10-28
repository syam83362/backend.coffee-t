import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CafeEntity } from './cafe.entity';

@Entity({ name: 'cafe_tables' })
@Index('uq_cafe_tables_cafe_number', ['cafeId', 'tableNumber'], { unique: true })
@Index('uq_cafe_tables_code', ['tableCode'], { unique: true })
export class CafeTableEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'cafe_id', type: 'uuid' })
  cafeId!: string;

  @ManyToOne(() => CafeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cafe_id' })
  cafe!: CafeEntity;

  @Column({ name: 'table_number', type: 'varchar', length: 20 })
  tableNumber!: string;

  @Column({ type: 'smallint', default: 2 })
  capacity!: number;

  @Column({ name: 'table_code', type: 'varchar', length: 64 })
  tableCode!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}