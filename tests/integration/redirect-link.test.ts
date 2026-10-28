import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, HEAD } from '@/app/[code]/route';
import { getDb } from '@/lib/db';
import { createLink } from '@/lib/links/create-link';
import { resolveLink } from '@/lib/links/resolve-link';
import { getTestDatabaseUrl } from '../helpers/test-database-url';

vi.mock('server-only', () => ({}));

const runId = randomUUID().replaceAll('-', '');
const ids: string[] = [];
let db: ReturnType<typeof getDb>;

beforeAll(() => {
  vi.stubEnv('DATABASE_URL', getTestDatabaseUrl());
  db = getDb();
});
afterAll(async () => {
  try {
    if (db) await db.link.deleteMany({ where: { id: { in: ids } } });
  } finally {
    if (db) await db.$disconnect();
    vi.unstubAllEnvs();
  }
});

function context(code: string) {
  return { params: Promise.resolve({ code }) };
}

describe('redirects with PostgreSQL', () => {
  it('resolves a created link with its saved query and fragment', async () => {
    const destination = `https://example.com/${runId}/article?saved=1#section`;
    const created = await createLink(destination);
    ids.push(created.id);

    const response = await GET(
      new Request(`http://localhost/${created.code}?ignored=1`),
      context(created.code),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(destination);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const head = await HEAD(
      new Request(`http://localhost/${created.code}`, { method: 'HEAD' }),
      context(created.code),
    );
    expect(head.status).toBe(302);
    expect(head.headers.get('location')).toBe(destination);
    expect(await head.text()).toBe('');
  });

  it('does not keep redirecting after the record is deleted', async () => {
    const created = await createLink(`https://example.com/${runId}/deleted`);
    ids.push(created.id);
    expect(await resolveLink(created.code)).not.toBeNull();
    await db.link.delete({ where: { id: created.id } });

    const response = await GET(
      new Request(`http://localhost/${created.code}`),
      context(created.code),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });

  it('resolves short codes case-sensitively', async () => {
    const upper = await db.link.create({
      data: {
        code: `Aa${runId.slice(0, 6)}`,
        destinationUrl: `https://example.com/${runId}/upper`,
      },
    });
    const lower = await db.link.create({
      data: {
        code: `aa${runId.slice(0, 6)}`,
        destinationUrl: `https://example.com/${runId}/lower`,
      },
    });
    ids.push(upper.id, lower.id);

    expect(await resolveLink(upper.code)).toBe(upper.destinationUrl);
    expect(await resolveLink(lower.code)).toBe(lower.destinationUrl);
  });

  it('refuses an unsafe destination inserted outside the creation API', async () => {
    const link = await db.link.create({
      data: {
        code: `Xx${runId.slice(0, 6)}`,
        destinationUrl: 'javascript:alert(1)',
      },
    });
    ids.push(link.id);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await GET(
        new Request(`http://localhost/${link.code}`),
        context(link.code),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('location')).toBeNull();
      expect(await response.text()).not.toContain(link.destinationUrl);
    } finally {
      log.mockRestore();
    }
  });
});
