import { IsUUID } from 'class-validator';

export class StartPaymentDto {
  @IsUUID()
  idempotencyKey!: string;
}