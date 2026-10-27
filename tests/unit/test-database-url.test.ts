import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTestDatabaseUrl } from '../helpers/test-database-url';

afterEach(() => vi.unstubAllEnvs());

describe('integration-test database isolation', () => {
  it('requires an explicit test URL instead of using application credentials', () => {
    vi.stubEnv('TEST_DATABASE_URL', undefined);
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/production');

    expect(getTestDatabaseUrl).toThrow('TEST_DATABASE_URL is required');
  });

  it.each([
    'postgresql://user:password@localhost:5432/shortlink_test',
    'postgres://user:password@127.0.0.1:5432/shortlink_test',
  ])('accepts a dedicated local test database', (url) => {
    vi.stubEnv('TEST_DATABASE_URL', url);

    expect(getTestDatabaseUrl()).toBe(url);
  });

  it.each([
    'postgresql://localhost/shortlink',
    'postgresql://database.example/shortlink_test',
    'https://localhost/shortlink_test',
    'invalid-secret-value',
  ])('rejects an unsafe migration target without disclosing it', (url) => {
    vi.stubEnv('TEST_DATABASE_URL', url);

    expect(getTestDatabaseUrl).toThrow('TEST_DATABASE_URL must');
  });
});
