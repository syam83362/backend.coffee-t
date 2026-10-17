import { IsIn } from 'class-validator';

export class ResolveDevelopmentPaymentDto {
  @IsIn(['success', 'failure'])
  outcome!: 'success' | 'failure';
}