import { config } from 'dotenv';
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';
import { getTestDatabaseUrl } from './tests/helpers/test-database-url';

config({ path: ['.env.local', '.env'], quiet: true });

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
    env: { DATABASE_URL: getTestDatabaseUrl(), NEXT_TELEMETRY_DISABLED: '1' },
  },
});
