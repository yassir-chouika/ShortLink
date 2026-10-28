// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLink } from '@/lib/links/resolve-link';
import { LinkValidationError } from '@/lib/links/errors';
import { DestinationBlockedError } from '@/lib/links/policy';
import { GET, HEAD } from './route';

vi.mock('@/lib/links/resolve-link', () => ({ resolveLink: vi.fn() }));
vi.mock('server-only', () => ({}));

const destination = 'https://example.com/article?saved=1#details';
const context = { params: Promise.resolve({ code: 'Ab12_cd3' }) };
const request = new Request('http://localhost/Ab12_cd3?ignored=1');

beforeEach(() => {
  vi.mocked(resolveLink).mockResolvedValue(destination);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('short-code redirect route', () => {
  it('returns 403 without a redirect or private destination for a blocked host', async () => {
    vi.mocked(resolveLink).mockRejectedValue(new DestinationBlockedError());
    const response = await GET(request, context);
    expect(response.status).toBe(403);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).error.code).toBe('DESTINATION_BLOCKED');
    expect(console.error).not.toHaveBeenCalled();
  });
  it('returns a temporary uncached redirect to the saved URL', async () => {
    const response = await GET(request, context);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(destination);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe('');
    expect(resolveLink).toHaveBeenCalledExactlyOnceWith('Ab12_cd3');
  });

  it('returns an uncached 404 for a missing link', async () => {
    vi.mocked(resolveLink).mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).error.code).toBe('LINK_NOT_FOUND');
  });

  it.each([
    new Error('postgresql://user:secret@private-host/database'),
    new LinkValidationError('INVALID_URL', 'Private stored URL'),
  ])(
    'returns a safe 503 when lookup or stored destination validation fails',
    async (error) => {
      vi.mocked(resolveLink).mockRejectedValue(error);
      const response = await GET(request, context);
      expect(response.status).toBe(503);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).not.toContain(error.message);
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Short-link resolution failed.',
        { type: error.name },
      );
    },
  );

  it.each([302, 403, 404, 503])(
    'HEAD preserves status and headers with no body',
    async (status) => {
      if (status === 404) vi.mocked(resolveLink).mockResolvedValue(null);
      if (status === 403)
        vi.mocked(resolveLink).mockRejectedValue(new DestinationBlockedError());
      if (status === 503)
        vi.mocked(resolveLink).mockRejectedValue(new Error('Unavailable'));
      const response = await HEAD(
        new Request(request.url, { method: 'HEAD' }),
        context,
      );

      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('location')).toBe(
        status === 302 ? destination : null,
      );
      expect(await response.text()).toBe('');
    },
  );
});
