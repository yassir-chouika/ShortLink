import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { getTestDatabaseUrl } from './tests/helpers/test-database-url';

config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: getTestDatabaseUrl() },
});
