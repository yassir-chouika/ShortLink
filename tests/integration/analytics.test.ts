import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { getLinkStats, recordRedirect } from '@/lib/links/analytics';
import { GET, HEAD } from '@/app/[code]/route';
import { getTestDatabaseUrl } from '../helpers/test-database-url';

vi.mock('server-only', () => ({}));
const runId = randomUUID().replaceAll('-', '');
const ids: string[] = [];
let db: ReturnType<typeof getDb>;
beforeAll(() => {
  vi.stubEnv('DATABASE_URL', getTestDatabaseUrl());
  vi.stubEnv('BLOCKED_LINK_HOSTS', 'blocked.example');
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

async function create(suffix: string, destinationUrl = 'https://example.com/') {
  const link = await db.link.create({
    data: { code: `${runId.slice(0, 6)}${suffix}`, destinationUrl },
  });
  ids.push(link.id);
  return link;
}
const context = (code: string) => ({ params: Promise.resolve({ code }) });

describe('aggregate analytics with PostgreSQL', () => {
  it('rolls back both counters on a failed daily increment and still redirects', async () => {
    const link = await create('A7');
    const [{ today }] = await db.$queryRaw<
      { today: Date }[]
    >`SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS today`;
    await db.linkClickDay.create({
      data: {
        linkId: link.id,
        day: today,
        clicks: BigInt('9223372036854775807'),
      },
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await GET(
        new Request(`http://localhost/${link.code}`),
        context(link.code),
      );
      expect(response.status).toBe(302);
      expect(
        (await db.link.findUniqueOrThrow({ where: { id: link.id } }))
          .totalClicks,
      ).toBe(BigInt(0));
      expect(
        (
          await db.linkClickDay.findUniqueOrThrow({
            where: { linkId_day: { linkId: link.id, day: today } },
          })
        ).clicks,
      ).toBe(BigInt('9223372036854775807'));
      expect(log).toHaveBeenCalledWith(
        'Redirect tracking failed.',
        expect.objectContaining({ type: expect.any(String) }),
      );
    } finally {
      log.mockRestore();
    }
  });
  it('counts every concurrent admitted GET atomically', async () => {
    const link = await create('A1');
    await Promise.all(
      Array.from({ length: 32 }, () => recordRedirect(link.code)),
    );
    const stats = await getLinkStats(link.code);
    expect(stats?.totalClicks).toBe(BigInt(32));
    expect(stats?.days.at(-1)?.clicks).toBe(BigInt(32));
    expect(await db.linkClickDay.count({ where: { linkId: link.id } })).toBe(1);
  });
  it('GET counts, while HEAD and repeated stats reads do not', async () => {
    const link = await create('A2');
    expect(
      (
        await HEAD(
          new Request(`http://localhost/${link.code}`, { method: 'HEAD' }),
          context(link.code),
        )
      ).status,
    ).toBe(302);
    expect((await getLinkStats(link.code))?.totalClicks).toBe(BigInt(0));
    expect(
      (
        await GET(
          new Request(`http://localhost/${link.code}`),
          context(link.code),
        )
      ).status,
    ).toBe(302);
    expect((await getLinkStats(link.code))?.totalClicks).toBe(BigInt(1));
    expect((await getLinkStats(link.code))?.totalClicks).toBe(BigInt(1));
  });
  it('does not count blocked destinations', async () => {
    const link = await create('A3', 'https://blocked.example/');
    expect(
      (
        await GET(
          new Request(`http://localhost/${link.code}`),
          context(link.code),
        )
      ).status,
    ).toBe(403);
    expect(
      (await db.link.findUniqueOrThrow({ where: { id: link.id } })).totalClicks,
    ).toBe(BigInt(0));
    expect(await db.linkClickDay.count({ where: { linkId: link.id } })).toBe(0);
  });
  it('prunes old daily rows only for the visited link, preserving lifetime totals', async () => {
    const link = await create('A4');
    const other = await create('A5');
    const [{ today }] = await db.$queryRaw<
      { today: Date }[]
    >`SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS today`;
    const old = new Date(today.getTime() - 7 * 86_400_000);
    const first = new Date(today.getTime() - 6 * 86_400_000);
    await db.link.update({
      where: { id: link.id },
      data: { totalClicks: BigInt(5) },
    });
    await db.linkClickDay.createMany({
      data: [
        { linkId: link.id, day: old, clicks: BigInt(3) },
        { linkId: link.id, day: first, clicks: BigInt(2) },
        { linkId: other.id, day: old, clicks: BigInt(1) },
      ],
    });
    await recordRedirect(link.code);
    const stats = await getLinkStats(link.code);
    expect(stats?.totalClicks).toBe(BigInt(6));
    expect(stats?.days[0].clicks).toBe(BigInt(2));
    expect(stats?.days.at(-1)?.clicks).toBe(BigInt(1));
    expect(await db.linkClickDay.count({ where: { linkId: link.id } })).toBe(2);
    expect(await db.linkClickDay.count({ where: { linkId: other.id } })).toBe(
      1,
    );
  });
  it('keeps bigint precision and cascades daily aggregates when a link is deleted', async () => {
    const link = await create('A6');
    await db.link.update({
      where: { id: link.id },
      data: { totalClicks: BigInt('9007199254740993') },
    });
    await recordRedirect(link.code);
    expect((await getLinkStats(link.code))?.totalClicks).toBe(
      BigInt('9007199254740994'),
    );
    await db.link.delete({ where: { id: link.id } });
    expect(await db.linkClickDay.count({ where: { linkId: link.id } })).toBe(0);
    await expect(recordRedirect(link.code)).resolves.toBeUndefined();
    expect(await getLinkStats(link.code)).toBeNull();
  });
});
