export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'CSRF_SECRET',
    'FRONTEND_ORIGIN',
  ];

  for (const key of required) {
    if (typeof config[key] !== 'string' || config[key].length === 0) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  for (const key of ['JWT_ACCESS_SECRET', 'CSRF_SECRET']) {
    if ((config[key] as string).length < 32) {
      throw new Error(`${key} must contain at least 32 characters`);
    }
  }

  const frontendOrigin = new URL(config.FRONTEND_ORIGIN as string);
  if (!['http:', 'https:'].includes(frontendOrigin.protocol)) {
    throw new Error('FRONTEND_ORIGIN must use HTTP or HTTPS');
  }

  return config;
}