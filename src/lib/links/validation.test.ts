import { describe, expect, it } from 'vitest';
import { LinkValidationError } from './errors';
import { validateLinkInput } from './validation';

describe('link input validation', () => {
  it.each([
    [
      ' HTTPS://EXAMPLE.COM:443/article?q=one#part ',
      'https://example.com/article?q=one#part',
    ],
    ['http://example.com', 'http://example.com/'],
    ['https://例え.com/hello', 'https://xn--r8jz45g.com/hello'],
    ['https://example.com/a%20b', 'https://example.com/a%20b'],
  ])('canonicalizes a valid absolute URL', (url, expected) => {
    expect(validateLinkInput({ url })).toBe(expected);
  });

  it.each([
    null,
    [],
    'https://example.com',
    {},
    { destinationUrl: 'https://example.com' },
    { url: 'https://example.com', code: 'custom' },
  ])('rejects unsupported request shapes and fields', (input) => {
    expect(() => validateLinkInput(input)).toThrow(LinkValidationError);
    expect(() => validateLinkInput(input)).toThrow('only a url field');
  });

  it.each([
    '',
    '   ',
    42,
    null,
    [],
    {},
    'example.com',
    '//example.com',
    '/relative',
    'https:example.com',
    'javascript:alert(1)',
    'data:text/html,test',
    'ftp://example.com/file',
    'https://',
    'https://example.com:99999',
    'https://user:password@example.com',
    'https://user@example.com',
    'https://exam\nple.com',
    'https://example.com/a b',
    'https://example.com/\u0000',
    'https://example.com\\path',
    `https://example.com/${'a'.repeat(2048)}`,
    `https://example.com/${'é'.repeat(500)}`,
  ])('rejects invalid, unsafe, or overlong destinations', (url) => {
    expect(() => validateLinkInput({ url })).toThrow(LinkValidationError);
  });

  it('accepts a normalized URL at the storage policy boundary', () => {
    const url = `https://example.com/${'a'.repeat(2028)}`;
    expect(url.length).toBe(2048);
    expect(validateLinkInput({ url })).toBe(url);
  });
});
