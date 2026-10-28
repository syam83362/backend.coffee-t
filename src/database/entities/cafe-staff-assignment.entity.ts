import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CafeEntity } from './cafe.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'cafe_staff_assignments' })
@Index('uq_cafe_staff_assignment', ['cafeId', 'userId'], { unique: true })
export class CafeStaffAssignmentEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'cafe_id', type: 'uuid' })
  cafeId!: string;

  @ManyToOne(() => CafeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cafe_id' })
  cafe!: CafeEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}