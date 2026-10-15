import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports healthy only after the database responds', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const service = new HealthService(dataSource as unknown as DataSource);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns service unavailable when the database check fails', async () => {
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('database down')) };
    const service = new HealthService(dataSource as unknown as DataSource);

    await expect(service.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});