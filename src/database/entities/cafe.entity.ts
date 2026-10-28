import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum CafeStatus {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity({ name: 'cafes' })
@Index('uq_cafes_slug', ['slug'], { unique: true })
export class CafeEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 140 })
  slug!: string;

  @Column({ type: 'enum', enum: CafeStatus, enumName: 'cafe_status' })
  status!: CafeStatus;

  @Column({ type: 'varchar', length: 80 })
  timezone!: string;

  @Column({ name: 'opening_time', type: 'time', default: '08:00' })
  openingTime!: string;

  @Column({ name: 'closing_time', type: 'time', default: '20:00' })
  closingTime!: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}