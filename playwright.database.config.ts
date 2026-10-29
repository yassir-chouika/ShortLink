import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';
import { getTestDatabaseUrl } from './tests/helpers/test-database-url';

config({ path: ['.env.local', '.env'], quiet: true });
// One namespace shared by this run's app server and workers, never production.
process.env.SHORTLINK_E2E_RATE_SCOPE ??= `e2e_${randomUUID().replaceAll('-', '')}`;
process.env.RATE_LIMIT_SCOPE = process.env.SHORTLINK_E2E_RATE_SCOPE;

// Spreading the base config keeps one server with the guarded test connection.
export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: '**/*.database.spec.ts',
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 60_000,
    // Override any application credentials with the explicitly guarded test URL.
    env: {
      DATABASE_URL: getTestDatabaseUrl(),
      NEXT_TELEMETRY_DISABLED: '1',
      VERCEL: '',
      LINK_CREATION_ENABLED: 'true',
      BLOCKED_LINK_HOSTS: 'blocked.example',
      RATE_LIMIT_SCOPE: process.env.RATE_LIMIT_SCOPE,
    },
  },
});
