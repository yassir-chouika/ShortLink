import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDatabaseUrl } from './database-config';

afterEach(() => vi.unstubAllEnvs());

describe('database configuration', () => {
  it('fails clearly when a database operation has no connection URL', () => {
    vi.stubEnv('DATABASE_URL', undefined);

    expect(getDatabaseUrl).toThrow('DATABASE_URL is required');
  });

  it.each([
    'postgresql://user:password@localhost:5432/shortlink',
    'postgres://user:password@localhost/shortlink?sslmode=require',
  ])('accepts a PostgreSQL connection URL', (url) => {
    vi.stubEnv('DATABASE_URL', url);

    expect(getDatabaseUrl()).toBe(url);
  });

  it.each([
    'not-a-url',
    'https://example.com/shortlink',
    'postgresql://localhost',
  ])('rejects an invalid connection URL without leaking its value', (url) => {
    vi.stubEnv('DATABASE_URL', url);

    expect(getDatabaseUrl).toThrow('DATABASE_URL must be');
    try {
      getDatabaseUrl();
    } catch (error) {
      expect((error as Error).message).not.toContain(url);
    }
  });
});
