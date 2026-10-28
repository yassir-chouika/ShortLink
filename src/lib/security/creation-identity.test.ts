// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCreationClientKey } from './creation-identity';

vi.mock('server-only', () => ({}));
const secret = 'a'.repeat(64);
afterEach(() => vi.unstubAllEnvs());

function request(headers: HeadersInit = {}) {
  return new Request('https://short.example/api/links', { headers });
}

describe('creation identity', () => {
  it('ignores all forwarded headers on a directly reachable server', () => {
    vi.stubEnv('VERCEL', '');
    expect(
      getCreationClientKey(
        request({
          'x-vercel-forwarded-for': '203.0.113.1',
          'x-forwarded-for': '198.51.100.1',
        }),
      ),
    ).toBe('local');
    expect(getCreationClientKey(request())).toBe('local');
  });

  it('hashes only the Vercel-supplied address with the private secret', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('RATE_LIMIT_SECRET', secret);
    const first = getCreationClientKey(
      request({
        'x-vercel-forwarded-for': '203.0.113.1',
        'x-forwarded-for': '198.51.100.1',
      }),
    );
    const forged = getCreationClientKey(
      request({
        'x-vercel-forwarded-for': '203.0.113.1',
        'x-forwarded-for': '198.51.100.2',
      }),
    );
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(forged);
    expect(first).not.toContain('203.0.113');
    expect(first).not.toBe(
      getCreationClientKey(
        request({ 'x-vercel-forwarded-for': '203.0.113.2' }),
      ),
    );
    vi.stubEnv('RATE_LIMIT_SECRET', 'b'.repeat(64));
    expect(first).not.toBe(
      getCreationClientKey(
        request({ 'x-vercel-forwarded-for': '203.0.113.1' }),
      ),
    );
  });

  it('canonicalizes equivalent IPv6 address spellings', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('RATE_LIMIT_SECRET', secret);
    expect(
      getCreationClientKey(
        request({ 'x-vercel-forwarded-for': '2001:db8::1' }),
      ),
    ).toBe(
      getCreationClientKey(
        request({ 'x-vercel-forwarded-for': '2001:0DB8:0:0:0:0:0:1' }),
      ),
    );
  });

  it.each([
    '',
    'not-an-ip',
    '203.0.113.1, 198.51.100.1',
    '127.1',
    'fe80::1%eth0',
  ])('rejects missing or malformed Vercel identity: %s', (address) => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('RATE_LIMIT_SECRET', secret);
    expect(() =>
      getCreationClientKey(request({ 'x-vercel-forwarded-for': address })),
    ).toThrow();
  });

  it.each(['', 'short', 'x'.repeat(257)])(
    'requires a properly sized secret on Vercel',
    (value) => {
      vi.stubEnv('VERCEL', '1');
      vi.stubEnv('RATE_LIMIT_SECRET', value);
      expect(() =>
        getCreationClientKey(
          request({ 'x-vercel-forwarded-for': '203.0.113.1' }),
        ),
      ).toThrow('RATE_LIMIT_SECRET');
    },
  );
});
