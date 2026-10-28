import { describe, expect, it, vi } from 'vitest';
import { LinkValidationError } from './errors';
import { resolveLink } from './resolve-link';

vi.mock('server-only', () => ({}));

describe('short-link resolution', () => {
  it.each([
    '',
    'short',
    'a'.repeat(9),
    'a'.repeat(32),
    'bad/code',
    'abcd.efg',
    'こんにちは',
    'abcd efh',
  ])(
    'rejects malformed codes before looking up a destination',
    async (code) => {
      const lookup = vi.fn();
      expect(await resolveLink(code, lookup)).toBeNull();
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it('preserves case and URL-safe code characters', async () => {
    const lookup = vi.fn().mockResolvedValue('https://example.com/a?x=1#part');
    expect(await resolveLink('Ab12_cd-', lookup)).toBe(
      'https://example.com/a?x=1#part',
    );
    expect(lookup).toHaveBeenCalledExactlyOnceWith('Ab12_cd-');
  });

  it('returns null for an unknown valid code', async () => {
    expect(
      await resolveLink('missing1', vi.fn().mockResolvedValue(null)),
    ).toBeNull();
  });

  it('canonicalizes a stored HTTP destination before returning it', async () => {
    expect(
      await resolveLink(
        'Ab12_cd3',
        vi.fn().mockResolvedValue(' HTTPS://EXAMPLE.COM:443/path '),
      ),
    ).toBe('https://example.com/path');
  });

  it.each([
    'javascript:alert(1)',
    '//example.com',
    'https://user:secret@example.com',
    'https://example.com/a\nb',
    'not a url',
  ])('rejects unsafe stored destinations', async (destination) => {
    await expect(
      resolveLink('Ab12_cd3', vi.fn().mockResolvedValue(destination)),
    ).rejects.toBeInstanceOf(LinkValidationError);
  });

  it('propagates a lookup failure for the HTTP layer to handle safely', async () => {
    const error = new Error('Private database detail');
    await expect(
      resolveLink('Ab12_cd3', vi.fn().mockRejectedValue(error)),
    ).rejects.toBe(error);
  });
});
