import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import {
  CreationRateLimitError,
  reserveCreationQuota,
  CLIENT_CREATION_LIMIT,
  GLOBAL_CREATION_LIMIT,
} from '@/lib/security/creation-quota';
import { getTestDatabaseUrl } from '../helpers/test-database-url';

vi.mock('server-only', () => ({}));
const prefix = `quota_${randomUUID().replaceAll('-', '')}`;
let db: ReturnType<typeof getDb>;

beforeAll(() => {
  vi.stubEnv('DATABASE_URL', getTestDatabaseUrl());
  db = getDb();
});

afterAll(async () => {
  try {
    if (db)
      await db.rateLimitBucket.deleteMany({
        where: { key: { startsWith: prefix.replaceAll('_', '\\_') } },
      });
  } finally {
    if (db) await db.$disconnect();
    vi.unstubAllEnvs();
  }
});

async function clock(): Promise<Date> {
  return (
    await db.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`
  )[0].now;
}

describe('shared PostgreSQL creation quotas', () => {
  it('admits exactly ten concurrent attempts and rolls back rejected daily reservations', async () => {
    const scope = `${prefix}_race`;
    const results = await Promise.allSettled(
      Array.from({ length: 24 }, () =>
        reserveCreationQuota('same-client', scope),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(CLIENT_CREATION_LIMIT);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(14);
    for (const result of rejected) {
      if (result.status !== 'rejected') continue;
      expect(result.reason).toBeInstanceOf(CreationRateLimitError);
      expect(result.reason.retryAfter).toBeGreaterThanOrEqual(1);
      expect(result.reason.retryAfter).toBeLessThanOrEqual(600);
    }
    expect(
      (
        await db.rateLimitBucket.findUniqueOrThrow({
          where: { key: `${scope}:global` },
        })
      ).hits,
    ).toBe(10);
    expect(
      (
        await db.rateLimitBucket.findUniqueOrThrow({
          where: { key: `${scope}:client:same-client` },
        })
      ).hits,
    ).toBe(10);
    await reserveCreationQuota('other-client', scope);
    expect(
      (
        await db.rateLimitBucket.findUniqueOrThrow({
          where: { key: `${scope}:global` },
        })
      ).hits,
    ).toBe(11);
  });

  it('enforces the last daily allowance across different clients', async () => {
    const scope = `${prefix}_daily`;
    const now = await clock();
    const tomorrow = new Date(
      (Math.floor(now.getTime() / 86_400_000) + 1) * 86_400_000,
    );
    await db.rateLimitBucket.create({
      data: {
        key: `${scope}:global`,
        hits: GLOBAL_CREATION_LIMIT - 1,
        expiresAt: tomorrow,
      },
    });
    const results = await Promise.allSettled(
      ['one', 'two'].map((client) => reserveCreationQuota(client, scope)),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason).toBeInstanceOf(
      CreationRateLimitError,
    );
    expect(
      (
        await db.rateLimitBucket.findUniqueOrThrow({
          where: { key: `${scope}:global` },
        })
      ).hits,
    ).toBe(500);
    expect(
      await db.rateLimitBucket.count({
        where: {
          key: { startsWith: `${scope.replaceAll('_', '\\_')}:client:` },
        },
      }),
    ).toBe(1);
  });

  it('resets expired windows and prunes only expired clients in its own scope', async () => {
    const scope = `${prefix}_expiry`;
    const now = await clock();
    const past = new Date(now.getTime() - 1000);
    const future = new Date(now.getTime() + 86_400_000);
    await db.rateLimitBucket.createMany({
      data: [
        { key: `${scope}:global`, hits: 500, expiresAt: past },
        { key: `${scope}:client:active`, hits: 10, expiresAt: past },
        { key: `${scope}:client:expired`, hits: 1, expiresAt: past },
        { key: `${scope}:client:keep`, hits: 1, expiresAt: future },
        { key: `${prefix}Xexpiry:client:expired`, hits: 1, expiresAt: past },
      ],
    });
    await reserveCreationQuota('active', scope);
    expect(
      (
        await db.rateLimitBucket.findUniqueOrThrow({
          where: { key: `${scope}:global` },
        })
      ).hits,
    ).toBe(1);
    const client = await db.rateLimitBucket.findUniqueOrThrow({
      where: { key: `${scope}:client:active` },
    });
    expect(client.hits).toBe(1);
    expect(client.expiresAt.getTime()).toBeGreaterThan(now.getTime());
    expect(
      await db.rateLimitBucket.findUnique({
        where: { key: `${scope}:client:expired` },
      }),
    ).toBeNull();
    expect(
      await db.rateLimitBucket.findUnique({
        where: { key: `${scope}:client:keep` },
      }),
    ).not.toBeNull();
    expect(
      await db.rateLimitBucket.findUnique({
        where: { key: `${prefix}Xexpiry:client:expired` },
      }),
    ).not.toBeNull();
  });

  it('rolls back a newly inserted daily row when a client is already limited', async () => {
    const scope = `${prefix}_rollback`;
    const now = await clock();
    await db.rateLimitBucket.create({
      data: {
        key: `${scope}:client:limited`,
        hits: 10,
        expiresAt: new Date(now.getTime() + 600_000),
      },
    });
    await expect(reserveCreationQuota('limited', scope)).rejects.toBeInstanceOf(
      CreationRateLimitError,
    );
    expect(
      await db.rateLimitBucket.findUnique({
        where: { key: `${scope}:global` },
      }),
    ).toBeNull();
  });

  it('rejects a malformed namespace without creating counters', async () => {
    await expect(
      reserveCreationQuota('client', `${prefix}:bad`),
    ).rejects.toThrow('RATE_LIMIT_SCOPE');
  });
});
