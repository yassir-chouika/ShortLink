export const MAX_JSON_BODY_BYTES = 8192;

export class RequestBodyError extends Error {
  readonly name = 'RequestBodyError';

  constructor(
    public readonly status: 400 | 413 | 415,
    public readonly code:
      'INVALID_JSON' | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE',
    message: string,
  ) {
    super(message);
  }
}

function oversizedBody(): RequestBodyError {
  return new RequestBodyError(
    413,
    'PAYLOAD_TOO_LARGE',
    `The request body must not exceed ${MAX_JSON_BODY_BYTES} bytes.`,
  );
}

/** Bound the actual stream size even if Content-Length is absent or inaccurate. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const mediaType = (request.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (mediaType !== 'application/json') {
    throw new RequestBodyError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Use Content-Type: application/json.',
    );
  }

  if (Number(request.headers.get('content-length')) > MAX_JSON_BODY_BYTES) {
    throw oversizedBody();
  }

  if (!request.body) {
    throw new RequestBodyError(400, 'INVALID_JSON', 'Send a valid JSON body.');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw oversizedBody();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(
      400,
      'INVALID_JSON',
      'Unable to read the JSON body.',
    );
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw new RequestBodyError(400, 'INVALID_JSON', 'Send valid UTF-8 JSON.');
  }
}
