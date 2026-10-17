import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['preparing', 'ready', 'delivered'])
  status!: 'preparing' | 'ready' | 'delivered';
}