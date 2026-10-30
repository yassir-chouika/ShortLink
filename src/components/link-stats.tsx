import Link from 'next/link';
import type { LinkStats } from '@/lib/links/analytics';

export function LinkStatsView({ stats }: { stats: LinkStats }) {
  const weekly = stats.days.reduce((sum, day) => sum + day.clicks, BigInt(0));
  const peak = stats.days.reduce(
    (max, day) => (day.clicks > max ? day.clicks : max),
    BigInt(0),
  );
  const cards = [
    ['Total recorded', stats.totalClicks],
    ['Last 7 days', weekly],
    ['Today (UTC)', stats.days.at(-1)?.clicks ?? BigInt(0)],
  ] as const;
  return (
    <div className="mx-auto min-h-svh max-w-5xl px-5 sm:px-10">
      <header className="flex items-center justify-between border-b border-stone-300 py-7">
        <Link
          href="/"
          className="text-3xl font-bold tracking-tighter"
          aria-label="Shrtnr. home"
        >
          Shrtnr<span className="text-emerald-800">.</span>
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-emerald-900 underline underline-offset-4"
        >
          Shorten another link
        </Link>
      </header>
      <main id="main-content" tabIndex={-1} className="py-12 sm:py-16">
        <p className="font-mono text-xs tracking-wide text-emerald-900">
          A LITTLE LINK. A LITTLE INSIGHT.
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Your link, in numbers.
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <code className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
            /{stats.code}
          </code>
          <a
            href={`/${stats.code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-emerald-900 underline underline-offset-4"
          >
            Open short link{' '}
            <span className="sr-only">(opens in a new tab)</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">
          Created {stats.createdAt.toISOString().slice(0, 10)} · Anyone with
          this short code can view these aggregate counts.
        </p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {cards.map(([label, count]) => (
            <div
              key={label}
              className="min-w-0 rounded-xl border border-stone-300 bg-white p-5"
            >
              <dt className="text-sm text-stone-600">{label}</dt>
              <dd className="mt-3 text-4xl font-semibold tracking-tight break-all tabular-nums">
                {count.toLocaleString('en-US')}
              </dd>
            </div>
          ))}
        </dl>
        <section
          aria-labelledby="daily-heading"
          className="mt-8 rounded-xl border border-stone-300 bg-white p-5 sm:p-7"
        >
          <h2
            id="daily-heading"
            className="text-xl font-semibold tracking-tight"
          >
            The last seven days
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Daily recorded redirects · UTC
          </p>
          {weekly === BigInt(0) && (
            <p className="mt-5 rounded-lg bg-[#edf2e8] p-4 text-sm leading-relaxed text-emerald-950">
              No redirects recorded in the last seven days. Share your short
              link or QR code to get started.
            </p>
          )}
          <table className="mt-5 w-full table-fixed text-left text-sm">
            <caption className="sr-only">
              Recorded redirects for each of the last seven UTC dates
            </caption>
            <thead>
              <tr className="border-b border-stone-200 text-stone-600">
                <th scope="col" className="w-32 py-3 font-medium">
                  Date (UTC)
                </th>
                <th scope="col" className="py-3 text-right font-medium">
                  Redirects
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.days.map(({ day, clicks }) => (
                <tr
                  key={day}
                  className="border-b border-stone-100 last:border-0"
                >
                  <th
                    scope="row"
                    className="py-4 font-mono text-xs font-normal"
                  >
                    {day}
                  </th>
                  <td className="relative py-4 text-right tabular-nums">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-3 right-0 rounded bg-emerald-100"
                      style={{
                        width: `${peak === BigInt(0) ? 0 : Number((clicks * BigInt(100)) / peak)}%`,
                      }}
                    />
                    <span className="relative break-all px-2 font-semibold text-emerald-950">
                      {clicks.toLocaleString('en-US')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-stone-600">
          Counts represent recorded GET redirects, including bots and repeat
          visits. They aren’t unique visitors or proof that the destination
          loaded. HEAD requests and this stats page don’t count. Tracking
          failures can leave totals incomplete.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-stone-600">
          No visitor IPs, user agents, or referrers are stored for these stats.
          Refresh the page to see new counts.
        </p>
      </main>
      <footer className="border-t border-stone-300 py-6 text-xs text-stone-600">
        Small links. Thoughtfully made.
      </footer>
    </div>
  );
}
