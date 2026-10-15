import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { accessCookieName } from './auth-cookie';
import { AuthenticatedRequestUser } from './auth.types';
import { UserRole } from '../database/entities/user.entity';

interface AccessTokenClaims {
  sub: string;
  role: UserRole;
}

type AuthenticatedExpressRequest = Request & { user?: AuthenticatedRequestUser };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedExpressRequest>();
    const token = request.cookies?.[accessCookieName()];
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
      });

      if (
        typeof claims.sub !== 'string' ||
        !Object.values(UserRole).includes(claims.role)
      ) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = { id: claims.sub, role: claims.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}