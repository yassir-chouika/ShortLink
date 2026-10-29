import { readJsonBody, RequestBodyError } from '@/lib/http/read-json-body';
import { jsonError, NO_STORE_HEADERS } from '@/lib/http/responses';
import { createLink } from '@/lib/links/create-link';
import { CodeAllocationError, LinkValidationError } from '@/lib/links/errors';
import { validateLinkInput } from '@/lib/links/validation';
import {
  assertCreationEnabled,
  assertDestinationAllowed,
  CreationPausedError,
  DestinationBlockedError,
} from '@/lib/links/policy';
import { getCreationClientKey } from '@/lib/security/creation-identity';
import {
  reserveCreationQuota,
  CreationRateLimitError,
} from '@/lib/security/creation-quota';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    assertCreationEnabled();
    const destinationUrl = validateLinkInput(await readJsonBody(request));
    assertDestinationAllowed(destinationUrl);
    await reserveCreationQuota(getCreationClientKey(request));
    const link = await createLink(destinationUrl);
    return Response.json(
      { data: link },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof CreationPausedError) {
      return jsonError(
        503,
        'LINK_CREATION_PAUSED',
        'Link creation is temporarily paused. Please try again later.',
      );
    }
    if (error instanceof DestinationBlockedError) {
      return jsonError(
        403,
        'DESTINATION_BLOCKED',
        'This destination is not available for shortening.',
      );
    }
    if (error instanceof CreationRateLimitError) {
      const response = jsonError(429, 'RATE_LIMITED', error.message);
      response.headers.set('Retry-After', String(error.retryAfter));
      return response;
    }
    if (error instanceof RequestBodyError) {
      return jsonError(error.status, error.code, error.message);
    }
    if (error instanceof LinkValidationError) {
      return jsonError(400, error.code, error.message);
    }
    if (error instanceof CodeAllocationError) {
      return jsonError(
        503,
        'CODE_ALLOCATION_FAILED',
        'Unable to allocate a short code. Please try again.',
      );
    }

    // Error messages and Prisma metadata may contain URLs or connection details.
    console.error('Link creation failed.', {
      type: error instanceof Error ? error.name : 'UnknownError',
    });
    return jsonError(
      503,
      'LINK_CREATION_UNAVAILABLE',
      'Link creation is temporarily unavailable. Please try again later.',
    );
  }
}
