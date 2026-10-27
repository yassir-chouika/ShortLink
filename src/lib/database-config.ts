/** Validate configuration without including credentials in an error message. */
export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error('DATABASE_URL is required for database access.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.pathname.length <= 1
  ) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with a database name.',
    );
  }

  return value;
}
