import { CookieOptions } from 'express';

export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_FAMILY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function accessCookieName(): string {
  return isProduction() ? '__Host-access_token' : 'access_token';
}

export function refreshCookieName(): string {
  return isProduction() ? '__Host-refresh_token' : 'refresh_token';
}

export function accessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  };
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

export function clearAccessCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...options } = accessCookieOptions();
  return options;
}

export function clearRefreshCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  return options;
}