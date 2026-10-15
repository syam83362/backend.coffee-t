import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { randomBytes } from 'node:crypto';
import { SESSION_FAMILY_TTL_MS } from './auth-cookie';

const CONTEXT_COOKIE = 'csrf_context';

@Injectable()
export class CsrfService {
  private readonly csrf = doubleCsrf({
    getSecret: () => this.config.getOrThrow<string>('CSRF_SECRET'),
    getSessionIdentifier: (request) =>
      request.cookies?.[CONTEXT_COOKIE] ?? 'missing-context',
    cookieName:
      process.env.NODE_ENV === 'production' ? '__Host-csrf-token' : 'csrf_token',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  });

  readonly protection = this.csrf.doubleCsrfProtection;

  constructor(private readonly config: ConfigService) {}

  readonly ensureContext = (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    request.cookies ??= {};
    if (!request.cookies[CONTEXT_COOKIE]) {
      const context = randomBytes(32).toString('base64url');
      request.cookies[CONTEXT_COOKIE] = context;
      response.cookie(CONTEXT_COOKIE, context, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_FAMILY_TTL_MS,
      });
    }
    next();
  };

  issueToken(request: Request, response: Response, rotate = false): string {
    if (rotate) {
      const context = randomBytes(32).toString('base64url');
      request.cookies[CONTEXT_COOKIE] = context;
      response.cookie(CONTEXT_COOKIE, context, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_FAMILY_TTL_MS,
      });
    }

    return this.csrf.generateCsrfToken(request, response, { overwrite: rotate });
  }
}