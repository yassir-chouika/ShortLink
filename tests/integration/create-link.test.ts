import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/links/route';
import { getDb } from '@/lib/db';
import { createLink } from '@/lib/links/create-link';
import { CodeAllocationError } from '@/lib/links/errors';
import { getTestDatabaseUrl } from '../helpers/test-database-url';

vi.mock('server-only', () => ({}));

const runId = randomUUID().replaceAll('-', '');
const destinationPrefix = `https://example.com/test/${runId}/`;
const codePrefix = runId.slice(0, 6);
let db: ReturnType<typeof getDb>;

beforeAll(() => {
  vi.stubEnv('DATABASE_URL', getTestDatabaseUrl());
  db = getDb();
});

afterAll(async () => {
  try {
    if (db) {
      await db.link.deleteMany({
        where: { destinationUrl: { startsWith: destinationPrefix } },
      });
    }
  } finally {
    if (db) await db.$disconnect();
    vi.unstubAllEnvs();
  }
});

describe('link creation with PostgreSQL', () => {
  it('persists the API result with the normalized destination', async () => {
    const destinationUrl = `${destinationPrefix}api?from=test#section`;
    const response = await POST(
      new Request('http://localhost/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: ` HTTPS://EXAMPLE.COM:443/test/${runId}/api?from=test#section `,
        }),
      }),
    );

    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data.code).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(data.destinationUrl).toBe(destinationUrl);

    const found = await db.link.findUniqueOrThrow({
      where: { code: data.code },
    });
    expect(found.id).toBe(data.id);
    expect(found.destinationUrl).toBe(destinationUrl);
    expect(found.createdAt.toISOString()).toBe(data.createdAt);
  });

  it('retries a real unique-index collision without changing the original link', async () => {
    const takenCode = `${codePrefix}A1`;
    const freshCode = `${codePrefix}A2`;
    await db.link.create({
      data: { code: takenCode, destinationUrl: `${destinationPrefix}original` },
    });
    const codes = [takenCode, freshCode];
    let attempts = 0;

    const created = await createLink(`${destinationPrefix}retry`, {
      generateCode: () => codes[attempts++],
    });

    expect(created.code).toBe(freshCode);
    expect(attempts).toBe(2);
    expect(
      (await db.link.findUniqueOrThrow({ where: { code: takenCode } }))
        .destinationUrl,
    ).toBe(`${destinationPrefix}original`);
  });

  it('stops after repeated real collisions without inserting a link', async () => {
    const takenCode = `${codePrefix}B1`;
    await db.link.create({
      data: { code: takenCode, destinationUrl: `${destinationPrefix}occupied` },
    });
    let attempts = 0;

    await expect(
      createLink(`${destinationPrefix}exhausted`, {
        generateCode: () => {
          attempts += 1;
          return takenCode;
        },
      }),
    ).rejects.toBeInstanceOf(CodeAllocationError);

    expect(attempts).toBe(5);
    expect(
      await db.link.count({
        where: { destinationUrl: `${destinationPrefix}exhausted` },
      }),
    ).toBe(0);
  });

  it('resolves concurrent attempts that initially choose the same code', async () => {
    const sharedCode = `${codePrefix}C1`;
    let attemptsA = 0;
    let attemptsB = 0;
    const [first, second] = await Promise.all([
      createLink(`${destinationPrefix}concurrent-a`, {
        generateCode: () =>
          attemptsA++ === 0 ? sharedCode : `${codePrefix}C2`,
      }),
      createLink(`${destinationPrefix}concurrent-b`, {
        generateCode: () =>
          attemptsB++ === 0 ? sharedCode : `${codePrefix}C3`,
      }),
    ]);

    expect(first.code).not.toBe(second.code);
    expect(attemptsA + attemptsB).toBe(3);
    expect(
      await db.link.count({
        where: { code: { in: [first.code, second.code] } },
      }),
    ).toBe(2);
  });
});
