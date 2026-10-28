import { readJsonBody, RequestBodyError } from '@/lib/http/read-json-body';
import { createLink } from '@/lib/links/create-link';
import { CodeAllocationError, LinkValidationError } from '@/lib/links/errors';
import { validateLinkInput } from '@/lib/links/validation';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: responseHeaders },
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const destinationUrl = validateLinkInput(await readJsonBody(request));
    const link = await createLink(destinationUrl);
    return Response.json(
      { data: link },
      { status: 201, headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return errorResponse(error.status, error.code, error.message);
    }
    if (error instanceof LinkValidationError) {
      return errorResponse(400, error.code, error.message);
    }
    if (error instanceof CodeAllocationError) {
      return errorResponse(
        503,
        'CODE_ALLOCATION_FAILED',
        'Unable to allocate a short code. Please try again.',
      );
    }

    // Error messages and Prisma metadata may contain URLs or connection details.
    console.error('Link creation failed.', {
      type: error instanceof Error ? error.name : 'UnknownError',
    });
    return errorResponse(
      503,
      'LINK_CREATION_UNAVAILABLE',
      'Link creation is temporarily unavailable. Please try again later.',
    );
  }
}
