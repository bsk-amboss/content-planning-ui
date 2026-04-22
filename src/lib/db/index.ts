import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '@/env';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

function createDb() {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set — the Postgres backend cannot be used. ' +
        'Provision Neon via the Vercel Marketplace or unset the DB path in the repositories layer.',
    );
  }
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) _db = createDb();
  return _db;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(env.DATABASE_URL);
}

export { schema };
