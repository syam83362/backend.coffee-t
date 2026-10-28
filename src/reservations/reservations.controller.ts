import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthRequest } from '../auth/auth-request';
import { CreateReservationDto, ReservationQueryDto } from './dto/reservation-query.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get('availability')
  availability(@Query() query: ReservationQueryDto) { return this.reservations.availability(query); }

  @Get('mine')
  @UseGuards(AccessTokenGuard)
  listMine(@Req() request: AuthRequest) { return this.reservations.listMine(request.user); }

  @Post()
  @UseGuards(AccessTokenGuard)
  create(@Req() request: AuthRequest, @Body() body: CreateReservationDto) { return this.reservations.create(request.user, body); }

  @Patch(':reservationId/cancel')
  @UseGuards(AccessTokenGuard)
  cancel(@Req() request: AuthRequest, @Param('reservationId', ParseUUIDPipe) id: string) { return this.reservations.cancel(request.user, id); }
}