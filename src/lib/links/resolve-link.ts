import 'server-only';
import { getDb } from '@/lib/db';
import { validateDestinationUrl } from './validation';

type DestinationLookup = (code: string) => Promise<string | null>;

async function lookupDestination(code: string): Promise<string | null> {
  const link = await getDb().link.findUnique({
    where: { code },
    select: { destinationUrl: true },
  });
  return link?.destinationUrl ?? null;
}

/** Reject malformed codes without a query, then validate the stored destination. */
export async function resolveLink(
  code: string,
  lookup: DestinationLookup = lookupDestination,
): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{8}$/.test(code)) return null;

  const destination = await lookup(code);
  if (destination === null) return null;
  return validateDestinationUrl(destination);
}
