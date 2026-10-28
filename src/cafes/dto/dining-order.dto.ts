import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DiningOrderLineDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class DiningOrderDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DiningOrderLineDto)
  items!: DiningOrderLineDto[];
}

export class TableOrderDto extends DiningOrderDto {
  @IsUUID()
  requestId = '';
}