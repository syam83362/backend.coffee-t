import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { UserEntity, UserRole } from '../database/entities/user.entity';
import { RefreshSessionEntity } from '../database/entities/refresh-session.entity';
import { IssuedTokens, PublicUser } from './auth.types';
import { REFRESH_TOKEN_TTL_MS, SESSION_FAMILY_TTL_MS } from './auth-cookie';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(RefreshSessionEntity)
    private readonly refreshSessions: Repository<RefreshSessionEntity>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(emailInput: string, password: string): Promise<IssuedTokens> {
    const email = emailInput.trim().toLowerCase();
    if (await this.users.findOneBy({ email })) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.users.create({
      id: randomUUID(),
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: UserRole.CUSTOMER,
      isActive: true,
    });

    try {
      const savedUser = await this.users.save(user);
      return this.issueSession(savedUser);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(emailInput: string, password: string): Promise<IssuedTokens> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.users.findOneBy({ email });

    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  async refresh(rawToken: string): Promise<IssuedTokens> {
    const tokenHash = hashToken(rawToken);
    const session = await this.refreshSessions.findOne({
      where: { tokenHash },
      relations: { user: true },
    });
    const now = new Date();

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      await this.refreshSessions.update(
        { familyId: session.familyId, revokedAt: IsNull() },
        { revokedAt: now },
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (
      session.expiresAt <= now ||
      session.familyExpiresAt <= now ||
      !session.user.isActive
    ) {
      await this.refreshSessions.update({ id: session.id }, { revokedAt: now });
      throw new UnauthorizedException('Refresh token expired');
    }

    const nextRawToken = randomBytes(32).toString('base64url');
    const nextSession = this.refreshSessions.create({
      id: randomUUID(),
      userId: session.userId,
      user: session.user,
      tokenHash: hashToken(nextRawToken),
      familyId: session.familyId,
      expiresAt: new Date(
        Math.min(now.getTime() + REFRESH_TOKEN_TTL_MS, session.familyExpiresAt.getTime()),
      ),
      familyExpiresAt: session.familyExpiresAt,
      revokedAt: null,
      replacedBySessionId: null,
    });

    const rotated = await this.dataSource.transaction(async (manager) => {
      const result = await manager.update(
        RefreshSessionEntity,
        {
          id: session.id,
          revokedAt: IsNull(),
          expiresAt: MoreThan(now),
          familyExpiresAt: MoreThan(now),
        },
        { revokedAt: now, replacedBySessionId: nextSession.id },
      );

      if (result.affected !== 1) {
        return false;
      }

      await manager.save(nextSession);
      return true;
    });

    if (!rotated) {
      await this.refreshSessions.update(
        { familyId: session.familyId, revokedAt: IsNull() },
        { revokedAt: now },
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return {
      user: toPublicUser(session.user),
      accessToken: await this.signAccessToken(session.user),
      refreshToken: nextRawToken,
    };
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) {
      return;
    }

    await this.refreshSessions.update(
      { tokenHash: hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findOneBy({ id: userId, isActive: true });
    if (!user) {
      throw new UnauthorizedException('Account is unavailable');
    }
    return toPublicUser(user);
  }

  private async issueSession(user: UserEntity): Promise<IssuedTokens> {
    const now = Date.now();
    const familyExpiresAt = new Date(now + SESSION_FAMILY_TTL_MS);
    const refreshToken = randomBytes(32).toString('base64url');
    const session = this.refreshSessions.create({
      id: randomUUID(),
      userId: user.id,
      user,
      tokenHash: hashToken(refreshToken),
      familyId: randomUUID(),
      expiresAt: new Date(Math.min(now + REFRESH_TOKEN_TTL_MS, familyExpiresAt.getTime())),
      familyExpiresAt,
      revokedAt: null,
      replacedBySessionId: null,
    });

    await this.refreshSessions.save(session);

    return {
      user: toPublicUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken,
    };
  }

  private signAccessToken(user: UserEntity): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, role: user.role }, {
      issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
      audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
      expiresIn: 600,
    });
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toPublicUser(user: UserEntity): PublicUser {
  return { id: user.id, email: user.email, role: user.role };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'driverError' in error &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    error.driverError.code === '23505'
  );
}