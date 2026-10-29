import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

/** Trust Vercel's overwritten header only when running on Vercel itself. */
export function getCreationClientKey(request: Request): string {
  // A directly reachable Next server has no trusted client-IP header. Sharing a
  // bucket is restrictive, but cannot be bypassed with forged forwarded headers.
  if (process.env.VERCEL !== '1') return 'local';

  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32 || secret.length > 256) {
    throw new Error(
      'RATE_LIMIT_SECRET must contain between 32 and 256 characters.',
    );
  }
  const address = request.headers.get('x-vercel-forwarded-for')?.trim();
  const family = address ? isIP(address) : 0;
  if (!address || !family || address.includes('%')) {
    throw new Error('A valid Vercel client address is required.');
  }
  // URL canonicalization collapses equivalent IPv6 spellings before hashing.
  const canonical =
    family === 6 ? new URL(`http://[${address}]`).hostname : address;
  return createHmac('sha256', secret).update(canonical).digest('hex');
}
