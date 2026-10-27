import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { getTestDatabaseUrl } from '../helpers/test-database-url';

// Next.js enforces this boundary at build time; Vitest runs outside its runtime.
vi.mock('server-only', () => ({}));

const prefix = randomUUID().replaceAll('-', '').slice(0, 16);
const codes = [`${prefix}-lookup`, `${prefix}-unique`, `${prefix}-rollback`];
let db: ReturnType<typeof getDb>;

beforeAll(() => {
  vi.stubEnv('DATABASE_URL', getTestDatabaseUrl());
  db = getDb();
});

afterAll(async () => {
  try {
    if (db) {
      // Only remove this run's records; preserve unrelated data even on failure.
      await db.link.deleteMany({ where: { code: { in: codes } } });
    }
  } finally {
    if (db) await db.$disconnect();
    vi.unstubAllEnvs();
  }
});

describe('PostgreSQL link persistence', () => {
  it('stores and retrieves a destination with generated identity and time', async () => {
    const destinationUrl =
      'https://example.com/articles?source=shortlink#section';
    const created = await db.link.create({
      data: { code: codes[0], destinationUrl },
    });
    const found = await db.link.findUnique({ where: { code: codes[0] } });

    expect(found).toMatchObject({ id: created.id, destinationUrl });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it('enforces short-code uniqueness at the database boundary', async () => {
    await db.link.create({
      data: { code: codes[1], destinationUrl: 'https://example.com/first' },
    });

    await expect(
      db.link.create({
        data: { code: codes[1], destinationUrl: 'https://example.com/second' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(await db.link.count({ where: { code: codes[1] } })).toBe(1);
  });

  it('returns null for an unknown short code', async () => {
    expect(await db.link.findUnique({ where: { code: codes[2] } })).toBeNull();
  });

  it('rolls back a failed transaction', async () => {
    await expect(
      db.$transaction(async (transaction) => {
        await transaction.link.create({
          data: {
            code: codes[2],
            destinationUrl: 'https://example.com/rollback',
          },
        });
        throw new Error('Rollback verification');
      }),
    ).rejects.toThrow('Rollback verification');

    expect(await db.link.findUnique({ where: { code: codes[2] } })).toBeNull();
  });
});
