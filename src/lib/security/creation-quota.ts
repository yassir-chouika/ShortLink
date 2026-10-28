import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';

export const CLIENT_CREATION_LIMIT = 10;
export const CLIENT_WINDOW_SECONDS = 600;
export const GLOBAL_CREATION_LIMIT = 500;
const DAY_SECONDS = 86_400;

export class CreationRateLimitError extends Error {
  readonly name = 'CreationRateLimitError';
  constructor(public readonly retryAfter: number) {
    super('Link creation limit reached. Please try again later.');
  }
}

async function reserveBucket(
  tx: Prisma.TransactionClient,
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date,
): Promise<void> {
  const windowMs = windowSeconds * 1000;
  const expiresAt = new Date(
    (Math.floor(now.getTime() / windowMs) + 1) * windowMs,
  );
  // Conditional upsert checks and increments under PostgreSQL's row lock. A
  // read-then-write counter would allow concurrent requests past the limit.
  const rows = await tx.$queryRaw<{ key: string }[]>`
    INSERT INTO "RateLimitBucket" ("key", "hits", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now}
        THEN 1 ELSE "RateLimitBucket"."hits" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now}
        THEN EXCLUDED."expiresAt" ELSE "RateLimitBucket"."expiresAt" END
    WHERE "RateLimitBucket"."expiresAt" <= ${now}
      OR "RateLimitBucket"."hits" < ${limit}
    RETURNING "key"
  `;
  if (rows.length === 0) {
    throw new CreationRateLimitError(
      Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
    );
  }
}

/** Reserve both quotas atomically. scope is internal, also used to isolate tests. */
export async function reserveCreationQuota(
  clientKey: string,
  scope = process.env.RATE_LIMIT_SCOPE ?? 'creation',
): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(scope))
    throw new Error(
      'RATE_LIMIT_SCOPE must contain 1 to 48 URL-safe characters.',
    );
  await getDb().$transaction(async (tx) => {
    const [{ now }] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    // Always acquire the global row first. If the client limit rejects, throwing
    // rolls back both reservations, so it cannot drain other clients' allowance.
    await reserveBucket(
      tx,
      `${scope}:global`,
      GLOBAL_CREATION_LIMIT,
      DAY_SECONDS,
      now,
    );
    await tx.rateLimitBucket.deleteMany({
      where: {
        // startsWith uses SQL LIKE, so namespace underscores must be escaped.
        key: { startsWith: `${scope.replaceAll('_', '\\_')}:client:` },
        expiresAt: { lte: now },
      },
    });
    await reserveBucket(
      tx,
      `${scope}:client:${clientKey}`,
      CLIENT_CREATION_LIMIT,
      CLIENT_WINDOW_SECONDS,
      now,
    );
  });
}
