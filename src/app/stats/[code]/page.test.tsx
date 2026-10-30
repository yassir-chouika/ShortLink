import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLinkStats } from '@/lib/links/analytics';
import { DestinationBlockedError } from '@/lib/links/policy';
import StatsPage from './page';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/links/analytics', () => ({ getLinkStats: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
const props = {
  params: Promise.resolve({ code: 'Ab12_cd3' }),
  searchParams: Promise.resolve({}),
};
afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('stats page boundaries', () => {
  it('returns not-found for missing stats', async () => {
    vi.mocked(getLinkStats).mockResolvedValue(null);
    await expect(StatsPage(props)).rejects.toThrow('NOT_FOUND');
  });
  it('does not expose blocked destinations', async () => {
    vi.mocked(getLinkStats).mockRejectedValue(new DestinationBlockedError());
    await expect(StatsPage(props)).rejects.toThrow('NOT_FOUND');
  });
  it('replaces backend failures with a safe error and safe logging', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(getLinkStats).mockRejectedValue(
      new Error('postgresql://private:secret@database'),
    );
    await expect(StatsPage(props)).rejects.toThrow(
      'Link stats are temporarily unavailable.',
    );
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'Link stats failed.',
      { type: 'Error' },
    );
  });
});
