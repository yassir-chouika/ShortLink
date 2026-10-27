import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { getDatabaseUrl } from './database-config';

const databaseGlobal = globalThis as typeof globalThis & {
  shortlinkDb?: PrismaClient;
};

/** Reuse a small pool per process, including across development hot reloads. */
export function getDb(): PrismaClient {
  if (!databaseGlobal.shortlinkDb) {
    const adapter = new PrismaPg({
      connectionString: getDatabaseUrl(),
      max: 2,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });

    databaseGlobal.shortlinkDb = new PrismaClient({ adapter });
  }

  return databaseGlobal.shortlinkDb;
}
