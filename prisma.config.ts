import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation needs no connection; migration commands require DIRECT_URL.
  datasource: { url: process.env.DIRECT_URL },
});
