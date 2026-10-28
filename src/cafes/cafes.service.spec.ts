import { ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CafeEntity } from '../database/entities/cafe.entity';
import { CafeTableEntity } from '../database/entities/cafe-table.entity';
import { CashCollectionEntity } from '../database/entities/cash-collection.entity';
import { OrderEntity } from '../database/entities/order.entity';
import { WaiterCallEntity } from '../database/entities/waiter-call.entity';
import { UserRole } from '../database/entities/user.entity';
import { CafesService } from './cafes.service';

describe('CafesService', () => {
  it('does not expose waiter calls to staff outside their assigned café', async () => {
    const assignmentRepository = { findOne: jest.fn().mockResolvedValue(null) };
    const callRepository = { find: jest.fn() };
    const dataSource = {
      manager: {
        getRepository: jest.fn(() => assignmentRepository),
      },
    } as unknown as DataSource;
    const service = new CafesService(
      dataSource,
      {} as Repository<CafeEntity>,
      {} as Repository<CafeTableEntity>,
      callRepository as unknown as Repository<WaiterCallEntity>,
      {} as Repository<OrderEntity>,
    );
    const waiter = { id: 'waiter-id', role: UserRole.WAITER } as AuthenticatedRequestUser;

    await expect(service.listWaiterCalls(waiter, 'other-cafe-id')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(assignmentRepository.findOne).toHaveBeenCalledWith({
      where: { cafeId: 'other-cafe-id', userId: waiter.id },
    });
    expect(callRepository.find).not.toHaveBeenCalled();
  });

  it('allows platform administrators to list all cafés without a staff assignment', async () => {
    const cafes = [{ id: 'cafe-a' }, { id: 'cafe-b' }];
    const cafeRepository = { find: jest.fn().mockResolvedValue(cafes) };
    const service = new CafesService(
      {} as DataSource,
      cafeRepository as unknown as Repository<CafeEntity>,
      {} as Repository<CafeTableEntity>,
      {} as Repository<WaiterCallEntity>,
      {} as Repository<OrderEntity>,
    );

    await expect(
      service.listAssignedCafes({ id: 'admin-id', role: UserRole.ADMIN } as AuthenticatedRequestUser),
    ).resolves.toEqual(cafes);
  });
});