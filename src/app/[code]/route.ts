import { jsonError, NO_STORE_HEADERS } from '@/lib/http/responses';
import { resolveLink } from '@/lib/links/resolve-link';
import { DestinationBlockedError } from '@/lib/links/policy';
import { recordRedirect } from '@/lib/links/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveRedirect(
  context: RouteContext<'/[code]'>,
  track: boolean,
): Promise<Response> {
  try {
    const { code } = await context.params;
    const destination = await resolveLink(code);
    if (destination === null) {
      return jsonError(
        404,
        'LINK_NOT_FOUND',
        'This short link could not be found.',
      );
    }

    if (track) {
      try {
        await recordRedirect(code);
      } catch (error) {
        // Analytics are best-effort; don't turn a valid destination into an error.
        console.error('Redirect tracking failed.', {
          type: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
    return new Response(null, {
      status: 302,
      headers: {
        ...NO_STORE_HEADERS,
        Location: destination,
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    if (error instanceof DestinationBlockedError) {
      return jsonError(
        403,
        'DESTINATION_BLOCKED',
        'This short link is not available.',
      );
    }
    // Stored URLs and database exception messages can contain private details.
    console.error('Short-link resolution failed.', {
      type: error instanceof Error ? error.name : 'UnknownError',
    });
    return jsonError(
      503,
      'LINK_UNAVAILABLE',
      'This short link is temporarily unavailable. Please try again later.',
    );
  }
}

export async function GET(
  _request: Request,
  context: RouteContext<'/[code]'>,
): Promise<Response> {
  return resolveRedirect(context, true);
}

export async function HEAD(
  _request: Request,
  context: RouteContext<'/[code]'>,
): Promise<Response> {
  const response = await resolveRedirect(context, false);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
