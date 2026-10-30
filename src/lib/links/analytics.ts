import 'server-only';
import { getDb } from '@/lib/db';
import { assertDestinationAllowed } from './policy';
import { validateDestinationUrl } from './validation';

export type ClickDay = { day: string; clicks: bigint };
export type LinkStats = {
  code: string;
  createdAt: Date;
  totalClicks: bigint;
  days: ClickDay[];
};

/** Record an admitted GET in one atomic statement, without visitor data. */
export async function recordRedirect(code: string): Promise<void> {
  // Updating the parent first serializes this link's counters. The upsert and
  // old-day cleanup are part of the same statement, so failure rolls it all back.
  await getDb().$executeRaw`
    WITH updated_link AS (
      UPDATE "Link" SET "totalClicks" = "totalClicks" + 1
      WHERE "code" = ${code} RETURNING "id"
    ), current_day AS (
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS "day"
    ), expired_days AS (
      DELETE FROM "LinkClickDay"
      WHERE "linkId" IN (SELECT "id" FROM updated_link)
        AND "day" < (SELECT "day" - 6 FROM current_day)
    )
    INSERT INTO "LinkClickDay" ("linkId", "day", "clicks")
    SELECT updated_link."id", current_day."day", 1 FROM updated_link, current_day
    ON CONFLICT ("linkId", "day") DO UPDATE
      SET "clicks" = "LinkClickDay"."clicks" + 1
  `;
}

/** Seven UTC dates, including today, with explicit zeroes for missing buckets. */
export function fillClickDays(
  now: Date,
  rows: { day: Date; clicks: bigint }[],
): ClickDay[] {
  const dayMs = 86_400_000;
  const today = Math.floor(now.getTime() / dayMs) * dayMs;
  const byDay = new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), row.clicks]),
  );
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today - (6 - index) * dayMs)
      .toISOString()
      .slice(0, 10);
    return { day, clicks: byDay.get(day) ?? BigInt(0) };
  });
}

export async function getLinkStats(code: string): Promise<LinkStats | null> {
  if (!/^[A-Za-z0-9_-]{8}$/.test(code)) return null;
  // Keep the clock, lifetime counter, and nested day query in one read snapshot.
  return getDb().$transaction(
    async (tx) => {
      const [{ now }] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      const firstDay = new Date(
        Math.floor(now.getTime() / 86_400_000) * 86_400_000 - 6 * 86_400_000,
      );
      const link = await tx.link.findUnique({
        where: { code },
        select: {
          createdAt: true,
          destinationUrl: true,
          totalClicks: true,
          clickDays: {
            where: { day: { gte: firstDay } },
            select: { day: true, clicks: true },
          },
        },
      });
      if (!link) return null;
      assertDestinationAllowed(validateDestinationUrl(link.destinationUrl));
      return {
        code,
        createdAt: link.createdAt,
        totalClicks: link.totalClicks,
        days: fillClickDays(now, link.clickDays),
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
