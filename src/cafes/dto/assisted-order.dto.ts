import { IsUUID } from 'class-validator';
import { DiningOrderDto } from './dining-order.dto';

export class AssistedOrderDto extends DiningOrderDto {
  @IsUUID()
  tableId!: string;

  @IsUUID()
  requestId = '';
}