// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLink } from '@/lib/links/create-link';
import { CodeAllocationError } from '@/lib/links/errors';
import { POST } from './route';

vi.mock('@/lib/links/create-link', () => ({ createLink: vi.fn() }));

const endpoint = 'http://localhost/api/links';
const record = {
  id: '94d1b2e4-61ac-42f1-8b59-c94aad7e819a',
  code: 'Ab12_cd3',
  destinationUrl: 'https://example.com/',
  createdAt: new Date('2026-10-28T00:00:00Z'),
};

function jsonRequest(payload: unknown): Request {
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  vi.mocked(createLink).mockResolvedValue(record);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('POST /api/links', () => {
  it('returns a non-cacheable 201 response for a validated destination', async () => {
    const response = await POST(
      jsonRequest({ url: ' HTTPS://EXAMPLE.COM:443 ' }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.json()).toEqual({
      data: { ...record, createdAt: record.createdAt.toISOString() },
    });
    expect(createLink).toHaveBeenCalledExactlyOnceWith('https://example.com/');
  });

  it.each([
    null,
    {},
    { url: 42 },
    { url: 'javascript:alert(1)' },
    { url: 'https://user:secret@example.com' },
  ])('rejects invalid input before database access', async (payload) => {
    const response = await POST(jsonRequest(payload));

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(createLink).not.toHaveBeenCalled();
  });

  it.each(['', '{broken-json'])(
    'rejects malformed or empty JSON',
    async (body) => {
      const response = await POST(
        new Request(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_JSON');
      expect(createLink).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing request body', async () => {
    const response = await POST(
      new Request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(response.status).toBe(400);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('requires JSON content type', async () => {
    const response = await POST(
      new Request(endpoint, { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(415);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('rejects an announced body larger than 8 KiB', async () => {
    const response = await POST(
      new Request(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '8193',
        },
        body: '{}',
      }),
    );
    expect(response.status).toBe(413);
    expect(createLink).not.toHaveBeenCalled();
  });

  it.each([undefined, '1'])(
    'bounds streamed bytes regardless of Content-Length',
    async (contentLength) => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (contentLength) headers.set('Content-Length', contentLength);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(4096));
          controller.enqueue(new Uint8Array(4097));
          controller.close();
        },
      });
      const init: RequestInit & { duplex: 'half' } = {
        method: 'POST',
        headers,
        body: stream,
        duplex: 'half',
      };

      const response = await POST(new Request(endpoint, init));
      expect(response.status).toBe(413);
      expect(createLink).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid UTF-8', async () => {
    const response = await POST(
      new Request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: new Uint8Array([255]),
      }),
    );
    expect(response.status).toBe(400);
    expect(createLink).not.toHaveBeenCalled();
  });

  it('handles a failed input stream without exposing its error', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('private input detail'));
      },
    });
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stream,
      duplex: 'half',
    };
    const response = await POST(new Request(endpoint, init));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('private input detail');
    expect(createLink).not.toHaveBeenCalled();
  });

  it('returns 503 after bounded collision attempts fail', async () => {
    vi.mocked(createLink).mockRejectedValue(new CodeAllocationError());
    const response = await POST(jsonRequest({ url: 'https://example.com' }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('CODE_ALLOCATION_FAILED');
  });

  it('keeps unexpected database details out of responses and logs', async () => {
    vi.mocked(createLink).mockRejectedValue(
      new Error('postgresql://user:secret@private-host/database'),
    );
    const response = await POST(jsonRequest({ url: 'https://example.com' }));

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'Link creation failed.',
      { type: 'Error' },
    );
  });
});
