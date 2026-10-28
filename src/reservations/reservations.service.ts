import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CafeEntity, CafeStatus } from '../database/entities/cafe.entity';
import { CafeReservationEntity, ReservationStatus } from '../database/entities/cafe-reservation.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { CreateReservationDto, ReservationQueryDto } from './dto/reservation-query.dto';
import { formatLocalDate, localDateTimeToUtc, zonedParts } from './reservation-time';

@Injectable()
export class ReservationsService {
  private readonly duration: number;
  private readonly slot: number;
  private readonly advanceDays: number;
  private readonly cancelCutoff: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(CafeEntity) private readonly cafes: Repository<CafeEntity>,
    @InjectRepository(CafeTableEntity) private readonly tables: Repository<CafeTableEntity>,
    @InjectRepository(CafeReservationEntity) private readonly reservations: Repository<CafeReservationEntity>,
  ) {
    this.duration = this.setting('BOOKING_DURATION_MINUTES', 90, 30, 240);
    this.slot = this.setting('BOOKING_SLOT_MINUTES', 30, 15, 120);
    this.advanceDays = this.setting('BOOKING_ADVANCE_DAYS', 30, 1, 365);
    this.cancelCutoff = this.setting('BOOKING_CANCELLATION_CUTOFF_MINUTES', 120, 0, 10080);
    if (this.duration % this.slot) throw new Error('Booking duration must be a multiple of slot size');
  }

  async availability(query: ReservationQueryDto) {
    const cafe = await this.findCafe(query.cafeId);
    const parsedDate = new Date(`${query.date}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || formatLocalDate(zonedParts(parsedDate, 'UTC')) !== query.date) {
      throw new BadRequestException('date must be a valid local calendar date');
    }
    const today = formatLocalDate(zonedParts(new Date(), cafe.timezone));
    const maximum = new Date(`${today}T00:00:00.000Z`);
    maximum.setUTCDate(maximum.getUTCDate() + this.advanceDays);
    if (query.date < today || query.date > formatLocalDate(zonedParts(maximum, 'UTC'))) {
      throw new BadRequestException(`Reservations are available up to ${this.advanceDays} days ahead`);
    }
    const opening = localDateTimeToUtc(`${query.date}T${cafe.openingTime.slice(0, 5)}`, cafe.timezone);
    const closing = localDateTimeToUtc(`${query.date}T${cafe.closingTime.slice(0, 5)}`, cafe.timezone);
    const tables = await this.tables.find({ where: { cafeId: cafe.id, isActive: true }, order: { capacity: 'ASC' } });
    const existing = await this.reservations.createQueryBuilder('reservation')
      .where('reservation.cafeId = :cafeId AND reservation.status = :status', { cafeId: cafe.id, status: ReservationStatus.CONFIRMED })
      .andWhere('reservation.startsAt < :closing AND reservation.endsAt > :opening', { opening, closing })
      .getMany();
    const slots: Array<{ startsAt: string; endsAt: string; tablesAvailable: number }> = [];
    for (let start = opening.getTime(); start + this.duration * 60_000 <= closing.getTime(); start += this.slot * 60_000) {
      if (start <= Date.now()) continue;
      const end = start + this.duration * 60_000;
      const count = tables.filter((table) => table.capacity >= query.partySize && !existing.some((reservation) =>
        reservation.cafeTableId === table.id && reservation.startsAt.getTime() < end && reservation.endsAt.getTime() > start,
      )).length;
      if (count) slots.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), tablesAvailable: count });
    }
    return { cafe: { id: cafe.id, name: cafe.name, timezone: cafe.timezone }, date: query.date, durationMinutes: this.duration, slots };
  }

  async create(user: AuthenticatedRequestUser, dto: CreateReservationDto) {
    const cafe = await this.findCafe(dto.cafeId);
    const startsAt = new Date(dto.startsAt);
    const parts = zonedParts(startsAt, cafe.timezone);
    const date = formatLocalDate(parts);
    const local = `${date}T${parts.hour.toString().padStart(2, '0')}:${parts.minute.toString().padStart(2, '0')}`;
    const normalized = localDateTimeToUtc(local, cafe.timezone);
    if (Math.abs(normalized.getTime() - startsAt.getTime()) > 1000 || parts.minute % this.slot !== 0) {
      throw new BadRequestException('Choose a reservation time aligned to an available slot');
    }
    const available = await this.availability({ cafeId: cafe.id, date, partySize: dto.partySize });
    const endsAt = new Date(startsAt.getTime() + this.duration * 60_000);
    if (!available.slots.some((entry) => entry.startsAt === startsAt.toISOString())) {
      throw new ConflictException('That reservation time is no longer available');
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tables = manager.getRepository(CafeTableEntity);
        const candidates = await tables.find({ where: { cafeId: cafe.id, isActive: true }, order: { capacity: 'ASC' } });
        for (const candidate of candidates.filter((table) => table.capacity >= dto.partySize)) {
          const table = await tables.createQueryBuilder('table').setLock('pessimistic_write')
            .where('table.id = :id', { id: candidate.id }).getOne();
          if (!table) continue;
          const overlap = await manager.getRepository(CafeReservationEntity).createQueryBuilder('reservation')
            .where('reservation.cafeTableId = :tableId AND reservation.status = :status', { tableId: table.id, status: ReservationStatus.CONFIRMED })
            .andWhere('reservation.startsAt < :endsAt AND reservation.endsAt > :startsAt', { startsAt, endsAt })
            .getOne();
          if (overlap) continue;
          return manager.getRepository(CafeReservationEntity).save(manager.getRepository(CafeReservationEntity).create({
            id: randomUUID(), cafeId: cafe.id, cafeTableId: table.id, userId: user.id,
            partySize: dto.partySize, startsAt, endsAt, status: ReservationStatus.CONFIRMED, cancelledAt: null,
          }));
        }
        throw new ConflictException('That reservation time is no longer available');
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23P01') {
        throw new ConflictException('That table was just reserved by another customer');
      }
      throw error;
    }
  }

  listMine(user: AuthenticatedRequestUser) {
    return this.reservations.find({ where: { userId: user.id }, relations: { cafe: true, table: true }, order: { startsAt: 'DESC' } });
  }

  async cancel(user: AuthenticatedRequestUser, id: string) {
    const reservation = await this.reservations.findOne({ where: { id, userId: user.id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== ReservationStatus.CONFIRMED) throw new ConflictException('Only confirmed reservations can be cancelled');
    if (reservation.startsAt.getTime() - Date.now() < this.cancelCutoff * 60_000) throw new ConflictException('The cancellation window has closed');
    reservation.status = ReservationStatus.CANCELLED;
    reservation.cancelledAt = new Date();
    return this.reservations.save(reservation);
  }

  private async findCafe(id: string) {
    const cafe = await this.cafes.findOne({ where: { id, status: CafeStatus.ACTIVE } });
    if (!cafe) throw new NotFoundException('Active café not found');
    try { new Intl.DateTimeFormat('en', { timeZone: cafe.timezone }); }
    catch { throw new BadRequestException('Café timezone is invalid'); }
    if (cafe.closingTime <= cafe.openingTime) throw new BadRequestException('Café reservation hours must close after opening');
    return cafe;
  }

  private setting(name: string, fallback: number, min: number, max: number): number {
    const value = Number(this.config.get(name, String(fallback)));
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
    return value;
  }
}