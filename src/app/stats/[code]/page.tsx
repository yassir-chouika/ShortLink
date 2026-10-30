import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LinkStatsView } from '@/components/link-stats';
import { getLinkStats } from '@/lib/links/analytics';
import { DestinationBlockedError } from '@/lib/links/policy';
import { LinkValidationError } from '@/lib/links/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Link stats | Shrtnr.',
  description: 'Aggregate redirect counts for a short link.',
  robots: { index: false, follow: false },
};

export default async function StatsPage({
  params,
}: PageProps<'/stats/[code]'>) {
  const { code } = await params;
  let stats;
  try {
    stats = await getLinkStats(code);
  } catch (error) {
    if (
      error instanceof DestinationBlockedError ||
      error instanceof LinkValidationError
    )
      notFound();
    console.error('Link stats failed.', {
      type: error instanceof Error ? error.name : 'UnknownError',
    });
    // Give Next's boundary a new safe error, without the database error as cause.
    throw new Error('Link stats are temporarily unavailable.');
  }
  if (!stats) notFound();
  return <LinkStatsView stats={stats} />;
}
