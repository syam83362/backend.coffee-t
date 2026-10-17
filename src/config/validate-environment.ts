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

  const bookingSettings: Record<string, [number, number]> = {
    BOOKING_DURATION_MINUTES: [30, 240],
    BOOKING_SLOT_MINUTES: [15, 120],
    BOOKING_ADVANCE_DAYS: [1, 365],
    BOOKING_CANCELLATION_CUTOFF_MINUTES: [0, 10080],
  };
  for (const [key, [minimum, maximum]] of Object.entries(bookingSettings)) {
    if (config[key] === undefined) continue;
    const value = Number(config[key]);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
  }
  const duration = Number(config.BOOKING_DURATION_MINUTES ?? 90);
  const slot = Number(config.BOOKING_SLOT_MINUTES ?? 30);
  if (duration % slot !== 0) {
    throw new Error('BOOKING_DURATION_MINUTES must be a multiple of BOOKING_SLOT_MINUTES');
  }

  const frontendOrigin = new URL(config.FRONTEND_ORIGIN as string);
  if (!['http:', 'https:'].includes(frontendOrigin.protocol)) {
    throw new Error('FRONTEND_ORIGIN must use HTTP or HTTPS');
  }

  return config;
}