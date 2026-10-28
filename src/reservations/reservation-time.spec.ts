import { formatLocalDate, localDateTimeToUtc, zonedParts } from './reservation-time';

describe('reservation time zones', () => {
  it('converts café-local India times to the correct UTC instant', () => {
    const instant = localDateTimeToUtc('2026-10-18T08:00', 'Asia/Kolkata');

    expect(instant.toISOString()).toBe('2026-10-18T02:30:00.000Z');
    expect(formatLocalDate(zonedParts(instant, 'Asia/Kolkata'))).toBe('2026-10-18');
  });

  it('rejects a wall-clock time skipped by a daylight-saving transition', () => {
    expect(() => localDateTimeToUtc('2026-03-29T02:30', 'Europe/Berlin')).toThrow(
      'The selected local time does not exist',
    );
  });
});