import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { PaymentAttemptStatus, PaymentProvider } from '../database/entities/payment-attempt.entity';
import { PaymentEventEntity } from '../database/entities/payment-event.entity';
import { PaymentsService } from './payments.service';

const customer = { id: 'customer-id', role: 'customer' } as AuthenticatedRequestUser;

describe('PaymentsService', () => {
  const originalEnvironment = process.env.NODE_ENV;

  afterEach(() => {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  });

  it('does not allow development outcomes in production', async () => {
    process.env.NODE_ENV = 'production';
    const dataSource = { transaction: jest.fn() } as unknown as DataSource;
    const service = new PaymentsService(dataSource);

    await expect(service.resolveDevelopment(customer, 'attempt-id', 'success')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('treats a repeated development event as idempotent', async () => {
    process.env.NODE_ENV = 'test';
    const attempt = {
      id: 'attempt-id',
      orderId: 'order-id',
      provider: PaymentProvider.DEVELOPMENT,
      status: PaymentAttemptStatus.SUCCEEDED,
      amountPaise: 10000,
    };
    const attemptQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(attempt),
    };
    const events = {
      findOne: jest.fn().mockResolvedValue({
        id: 'event-id',
        providerEventId: 'dev-attempt-id-success',
      }),
      save: jest.fn(),
      create: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn(() => events),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (value: typeof manager) => unknown) => callback(manager)),
    } as unknown as DataSource;
    (manager.getRepository as jest.Mock).mockImplementation((entity: Function) =>
      entity === PaymentEventEntity
        ? events
        : { createQueryBuilder: jest.fn(() => attemptQuery) },
    );
    const service = new PaymentsService(dataSource);

    const result = await service.resolveDevelopment(customer, 'attempt-id', 'success');

    expect(result).toMatchObject({
      id: 'attempt-id',
      status: PaymentAttemptStatus.SUCCEEDED,
      developmentSimulationAvailable: false,
    });
    expect(events.save).not.toHaveBeenCalled();
  });
});