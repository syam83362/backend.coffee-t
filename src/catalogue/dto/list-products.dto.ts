import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsIn, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ProductChannel } from '../../database/entities/product-availability.entity';

export class ListProductsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 12;

  @IsOptional()
  @IsEnum(ProductChannel)
  channel: ProductChannel = ProductChannel.ONLINE;

  @IsOptional()
  @IsUUID()
  cafeId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  @Transform(({ value }) => value === 'true')
  availableOnly = false;
}