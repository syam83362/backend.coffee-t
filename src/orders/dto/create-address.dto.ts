import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipientName!: string;

  @Matches(/^\+?[0-9 ()-]{8,20}$/)
  phone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state!: string;

  @Matches(/^[1-9][0-9]{5}$/)
  pincode!: string;
}