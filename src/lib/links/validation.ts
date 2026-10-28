import { LinkValidationError } from './errors';

export const MAX_DESTINATION_LENGTH = 2048;

/** Accept one absolute HTTP(S) URL and return its canonical representation. */
export function validateLinkInput(input: unknown): string {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    !('url' in input) ||
    Object.keys(input).length !== 1
  ) {
    throw new LinkValidationError(
      'INVALID_REQUEST',
      'Send a JSON object containing only a url field.',
    );
  }

  return validateDestinationUrl(input.url);
}

/** Normalize a destination for storage or a redirect's Location header. */
export function validateDestinationUrl(input: unknown): string {
  if (typeof input !== 'string') {
    throw new LinkValidationError('INVALID_URL', 'url must be a string.');
  }

  const value = input.trim();
  if (!value || value.length > MAX_DESTINATION_LENGTH) {
    throw new LinkValidationError(
      'INVALID_URL',
      `url must contain between 1 and ${MAX_DESTINATION_LENGTH} characters.`,
    );
  }

  if (!/^https?:\/\//i.test(value) || /[\p{Cc}\s\\]/u.test(value)) {
    throw new LinkValidationError(
      'INVALID_URL',
      'Use an absolute HTTP or HTTPS URL without unescaped whitespace or backslashes.',
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LinkValidationError(
      'INVALID_URL',
      'url must be a valid HTTP or HTTPS URL.',
    );
  }

  if (url.username || url.password) {
    throw new LinkValidationError(
      'INVALID_URL',
      'URLs containing a username or password are not supported.',
    );
  }

  if (url.href.length > MAX_DESTINATION_LENGTH) {
    throw new LinkValidationError(
      'INVALID_URL',
      `The normalized URL must not exceed ${MAX_DESTINATION_LENGTH} characters.`,
    );
  }

  return url.href;
}
