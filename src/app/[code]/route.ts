import { NO_STORE_HEADERS } from '@/lib/http/responses';
import { redirectError } from '@/lib/http/redirect-error';
import { resolveLink } from '@/lib/links/resolve-link';
import { DestinationBlockedError } from '@/lib/links/policy';
import { recordRedirect } from '@/lib/links/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveRedirect(
  request: Request,
  context: RouteContext<'/[code]'>,
  track: boolean,
): Promise<Response> {
  try {
    const { code } = await context.params;
    const destination = await resolveLink(code);
    if (destination === null) {
      return redirectError(request, 404);
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
      return redirectError(request, 403);
    }
    // Stored URLs and database exception messages can contain private details.
    console.error('Short-link resolution failed.', {
      type: error instanceof Error ? error.name : 'UnknownError',
    });
    return redirectError(request, 503);
  }
}

export async function GET(
  request: Request,
  context: RouteContext<'/[code]'>,
): Promise<Response> {
  return resolveRedirect(request, context, true);
}

export async function HEAD(
  request: Request,
  context: RouteContext<'/[code]'>,
): Promise<Response> {
  const response = await resolveRedirect(request, context, false);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
