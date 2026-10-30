// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { prefersHtml, redirectError } from './redirect-error';

vi.mock('server-only', () => ({}));

describe('redirect error representation', () => {
  it.each([
    [null, false],
    ['*/*', false],
    ['application/json', false],
    ['text/*', false],
    ['text/html', true],
    ['TEXT/HTML;Q=0.8', true],
    ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', true],
    ['text/html,*/*', true],
    ['text/html;q=0,*/*;q=1', false],
    ['text/html;q=0.5,application/json;q=0.9', false],
    ['text/html;q=0.5,application/json;q=0,*/*;q=1', true],
    ['text/html,application/json', false],
    ['text/html;q=0.1,application/*;q=0.9', false],
    ['text/html;q=invalid', false],
    ['text/html;q=2', false],
  ])('negotiates %s as HTML: %s', (accept, expected) => {
    expect(prefersHtml(accept)).toBe(expected);
  });

  it.each([
    [403, 'DESTINATION_BLOCKED', 'This link isn’t available.'],
    [404, 'LINK_NOT_FOUND', 'This link is missing.'],
    [503, 'LINK_UNAVAILABLE', 'A short pause.'],
  ] as const)(
    'returns %i in both representations with safe headers',
    async (status, code, title) => {
      for (const accept of ['application/json', 'text/html']) {
        const response = redirectError(
          new Request('https://short.example/Ab12_cd3', {
            headers: { Accept: accept },
          }),
          status,
        );
        expect(response.status).toBe(status);
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('vary')).toBe('Accept');
        expect(response.headers.get('referrer-policy')).toBe('no-referrer');
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        if (accept === 'application/json')
          expect((await response.json()).error.code).toBe(code);
        else {
          expect(response.headers.get('content-type')).toBe(
            'text/html; charset=utf-8',
          );
          const html = await response.text();
          expect(html).toContain(`<h1>${title}</h1>`);
          expect(html.includes('>Try again</a>')).toBe(status === 503);
          const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
          expect(style).toBeDefined();
          const hash = createHash('sha256').update(style!).digest('base64');
          expect(response.headers.get('content-security-policy')).toContain(
            `style-src 'sha256-${hash}'`,
          );
          expect(html).not.toContain('<script');
        }
      }
    },
  );

  it('never reflects request URLs or header values into HTML', async () => {
    const marker = 'PRIVATE_MARKER_123';
    const response = redirectError(
      new Request(`https://short.example/${marker}?input=%3Cscript%3E`, {
        headers: { Accept: `text/html; ignored=${marker}` },
      }),
      404,
    );
    const html = await response.text();
    expect(html).not.toContain(marker);
    expect(html).not.toContain('short.example');
    expect(html).not.toContain('<script>');
  });
});
