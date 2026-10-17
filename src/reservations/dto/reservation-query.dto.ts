import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

export class ReservationQueryDto {
  @IsUUID()
  cafeId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  partySize!: number;
}

export class CreateReservationDto {
  @IsUUID()
  cafeId!: string;

  @IsDateString({ strict: true })
  startsAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  partySize!: number;
}