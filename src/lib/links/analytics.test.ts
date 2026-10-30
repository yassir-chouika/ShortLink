// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fillClickDays, getLinkStats } from './analytics';
import { getDb } from '@/lib/db';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));

describe('analytics date presentation', () => {
  it('fills seven UTC dates across year boundaries with missing days at zero', () => {
    const days = fillClickDays(new Date('2027-01-02T23:59:59Z'), [
      {
        day: new Date('2026-12-31T00:00:00Z'),
        clicks: BigInt('9007199254740993'),
      },
      { day: new Date('2027-01-02T00:00:00Z'), clicks: BigInt(2) },
    ]);
    expect(days.map((day) => day.day)).toEqual([
      '2026-12-27',
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(days[0].clicks).toBe(BigInt(0));
    expect(days[4].clicks).toBe(BigInt('9007199254740993'));
    expect(days[6].clicks).toBe(BigInt(2));
  });
  it('uses UTC rather than the caller’s offset calendar date', () => {
    expect(
      fillClickDays(new Date('2026-03-29T01:30:00+02:00'), []).at(-1)?.day,
    ).toBe('2026-03-28');
  });
  it.each(['short', 'bad/code', 'abcdefghij'])(
    'rejects malformed stats codes before database access: %s',
    async (code) => {
      expect(await getLinkStats(code)).toBeNull();
      expect(getDb).not.toHaveBeenCalled();
    },
  );
});
