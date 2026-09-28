import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
// Worker build of the same schema (`runtime = "cloudflare"` in
// prisma/schema.prisma). workerd cannot load a native query engine, so this
// client ships the WebAssembly query engine instead. The import is static on
// purpose: the generated client resolves asynchronously, and the bundler has to
// see the dependency to await it. The Node.js runtime only ever evaluates the
// module - it never instantiates the client - so `next dev`, the tests and the
// scripts keep using the native client below.
import { PrismaClient as CloudflarePrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Type of the D1 binding (`globalThis.DB` is declared in src/types/cloudflare.d.ts). */
type D1Binding = NonNullable<typeof globalThis.DB>;

/**
 * The D1 binding of the current request, when running on Cloudflare.
 *
 * The OpenNext adapter only mirrors string bindings into `process.env`, so the
 * database binding has to be read from the Cloudflare context (`globalThis.DB`
 * stays as a fallback for runtimes that expose bindings globally). Outside of a
 * Cloudflare request - `next dev`, the tests, the seed and import scripts - the
 * lookup throws and the caller falls back to `DATABASE_URL`.
 */
function getD1Binding(): D1Binding | undefined {
  if (globalThis.DB) return globalThis.DB;
  try {
    return getCloudflareContext().env.DB;
  } catch {
    return undefined;
  }
}

function createClient(): PrismaClient {
  const db = getD1Binding();
  // On Cloudflare Workers the D1 binding replaces the file-based SQLite
  // connection; locally the driver adapter is not available and the client
  // falls back to DATABASE_URL from the environment.
  if (db) {
    const adapter = new PrismaD1(db);
    return new CloudflarePrismaClient({ adapter }) as unknown as PrismaClient;
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}