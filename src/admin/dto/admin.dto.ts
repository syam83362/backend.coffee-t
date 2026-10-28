import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CafeStatus } from '../../database/entities/cafe.entity';
import { ProductDiscoveryStatus } from '../../database/entities/product.entity';
import { UserRole } from '../../database/entities/user.entity';

export class CreateCafeDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(140) slug!: string;
  @IsString() @MaxLength(80) timezone!: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}

export class UpdateCafeDto {
  @IsOptional() @IsEnum(CafeStatus) status?: CafeStatus;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) openingTime?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) closingTime?: string;
}

export class CreateTableDto {
  @IsString() @MinLength(1) @MaxLength(20) tableNumber!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) capacity!: number;
}

export class AssignCafeStaffDto {
  @IsUUID() userId!: string;
  @IsEnum(UserRole) role!: UserRole.CAFE_MANAGER | UserRole.WAITER;
}

export class CafeVariantConfigDto {
  @IsBoolean() isAvailable!: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) quantity!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) priceOverridePaise?: number;
}

export class GlobalVariantConfigDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(10000000) pricePaise!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) stockQuantity!: number;
  @IsBoolean() isActive!: boolean;
}

export class CreateCategoryDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class CreateProductDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(180) slug!: string;
  @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsEnum(ProductDiscoveryStatus) discoveryStatus?: ProductDiscoveryStatus;
}

export class CreateVariantDto {
  @IsString() @MinLength(2) @MaxLength(64) sku!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10000000) pricePaise!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) stockQuantity!: number;
}