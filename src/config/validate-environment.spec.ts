import { validateEnvironment } from './validate-environment';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL: 'postgresql://coffee_t:secret@127.0.0.1:5432/coffee_t',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_ISSUER: 'coffee-t-api',
    JWT_AUDIENCE: 'coffee-t-store',
    CSRF_SECRET: 'b'.repeat(32),
    FRONTEND_ORIGIN: 'http://localhost:3000',
  };

  it('accepts a complete local configuration', () => {
    expect(validateEnvironment(validEnvironment)).toBe(validEnvironment);
  });

  it('rejects a missing required value', () => {
    const { DATABASE_URL: _databaseUrl, ...missingDatabaseUrl } = validEnvironment;

    expect(() => validateEnvironment(missingDatabaseUrl)).toThrow(
      'Missing required environment variable: DATABASE_URL',
    );
  });

  it('rejects short signing secrets', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow('JWT_ACCESS_SECRET must contain at least 32 characters');
  });

  it('rejects a frontend origin with an unsupported protocol', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, FRONTEND_ORIGIN: 'ftp://localhost' }),
    ).toThrow('FRONTEND_ORIGIN must use HTTP or HTTPS');
  });
});