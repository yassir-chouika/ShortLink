/** Keep integration-test migrations confined to a dedicated local database. */
export function getTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;

  if (!value) {
    throw new Error('TEST_DATABASE_URL is required for integration tests.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    !parsed.pathname.endsWith('_test')
  ) {
    throw new Error(
      'TEST_DATABASE_URL must point to localhost and a database ending in _test.',
    );
  }

  return value;
}
