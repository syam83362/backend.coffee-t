import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { RefreshSessionEntity } from '../database/entities/refresh-session.entity';
import { UserEntity, UserRole } from '../database/entities/user.entity';
import { AuthService, hashToken } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: { findOneBy: jest.Mock; create: jest.Mock; save: jest.Mock };
  let sessions: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let transactionManager: { update: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    users = {
      findOneBy: jest.fn(),
      create: jest.fn((input) => input as UserEntity),
      save: jest.fn(async (input) => input as UserEntity),
    };
    sessions = {
      create: jest.fn((input) => input as RefreshSessionEntity),
      save: jest.fn(async (input) => input as RefreshSessionEntity),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    transactionManager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (input) => input),
    };
    dataSource = {
      transaction: jest.fn(async (callback) =>
        callback(transactionManager as unknown as import('typeorm').EntityManager),
      ),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };

    const config = {
      getOrThrow: (key: string) =>
        ({ JWT_ISSUER: 'coffee-t-api', JWT_AUDIENCE: 'coffee-t-store' })[key],
    } as ConfigService;

    service = new AuthService(
      users as unknown as Repository<UserEntity>,
      sessions as unknown as Repository<RefreshSessionEntity>,
      dataSource as unknown as DataSource,
      jwt as unknown as import('@nestjs/jwt').JwtService,
      config,
    );
  });

  it('registers a customer with an Argon2id hash and only stores a refresh-token hash', async () => {
    (users.findOneBy as jest.Mock).mockResolvedValue(null);
    (users.save as jest.Mock).mockImplementation(async (input: UserEntity) => ({
      ...input,
      role: UserRole.CUSTOMER,
      isActive: true,
    }));

    const result = await service.register('  CUSTOMER@example.com ', 'a-long-test-password');

    expect(result.user.email).toBe('customer@example.com');
    expect(result.user.role).toBe(UserRole.CUSTOMER);
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).not.toBeUndefined();
    expect((users.save as jest.Mock).mock.calls[0][0].passwordHash).not.toBe(
      'a-long-test-password',
    );
    await expect(
      argon2.verify(
        (users.save as jest.Mock).mock.calls[0][0].passwordHash,
        'a-long-test-password',
      ),
    ).resolves.toBe(true);
    expect((sessions.save as jest.Mock).mock.calls[0][0].tokenHash).toBe(
      hashToken(result.refreshToken),
    );
  });

  it('rejects login for an unknown email without revealing account existence', async () => {
    (users.findOneBy as jest.Mock).mockResolvedValue(null);

    await expect(service.login('nobody@example.com', 'wrong-password')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  it('rotates refresh tokens and records the replacement transactionally', async () => {
    const oldToken = 'old-refresh-token';
    const user: UserEntity = {
      id: 'user-id',
      email: 'customer@example.com',
      passwordHash: 'unused-in-this-test',
      role: UserRole.CUSTOMER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      refreshSessions: [],
    };
    const session: RefreshSessionEntity = {
      id: 'session-id',
      userId: user.id,
      user,
      tokenHash: hashToken(oldToken),
      familyId: 'family-id',
      expiresAt: new Date(Date.now() + 60_000),
      familyExpiresAt: new Date(Date.now() + 600_000),
      revokedAt: null,
      replacedBySessionId: null,
      createdAt: new Date(),
    };
    (sessions.findOne as jest.Mock).mockResolvedValue(session);

    const result = await service.refresh(oldToken);

    expect(result.refreshToken).not.toBe(oldToken);
    expect((sessions.create as jest.Mock).mock.calls[0][0].tokenHash).toBe(
      hashToken(result.refreshToken),
    );
    expect(transactionManager.update).toHaveBeenCalledWith(
      RefreshSessionEntity,
      expect.objectContaining({ id: session.id }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(transactionManager.save).toHaveBeenCalledTimes(1);
  });

  it('revokes the remaining token family when a rotated token is reused', async () => {
    const session = {
      id: 'old-session',
      familyId: 'family-id',
      tokenHash: hashToken('replayed-token'),
      revokedAt: new Date(),
    } as RefreshSessionEntity;
    (sessions.findOne as jest.Mock).mockResolvedValue(session);

    await expect(service.refresh('replayed-token')).rejects.toThrow(
      new UnauthorizedException('Refresh token reuse detected'),
    );
    expect(sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: session.familyId }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it('revokes the supplied refresh token on logout', async () => {
    await service.logout('logout-token');

    expect(sessions.update).toHaveBeenCalledWith(
      { tokenHash: hashToken('logout-token'), revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });
});