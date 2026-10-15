import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('Health endpoint', () => {
  let app: INestApplication;
  const dataSource = { query: jest.fn() };

  beforeEach(async () => {
    dataSource.query.mockReset().mockResolvedValue([{ '?column?': 1 }]);

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a healthy response when PostgreSQL responds', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
  });

  it('returns the standard error shape when PostgreSQL is unavailable', async () => {
    dataSource.query.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await request(app.getHttpServer()).get('/health').expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503,
      message: 'Database is unavailable',
      path: '/health',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });
});