export class LinkValidationError extends Error {
  readonly name = 'LinkValidationError';

  constructor(
    public readonly code: 'INVALID_REQUEST' | 'INVALID_URL',
    message: string,
  ) {
    super(message);
  }
}

export class CodeAllocationError extends Error {
  readonly name = 'CodeAllocationError';

  constructor() {
    super('A unique short code could not be allocated.');
  }
}
