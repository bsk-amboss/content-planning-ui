import type { Config } from 'drizzle-kit';

// drizzle-kit does not auto-load .env.local. Run commands via dotenv-cli:
//   npm run db:generate
//   npm run db:push
//   npm run db:migrate
//
// Prefer the unpooled connection for DDL (direct connection, no PgBouncer).
// The Vercel Neon integration prefixes every var with STORAGE_, so we accept
// both names.
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.STORAGE_DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  process.env.STORAGE_DATABASE_URL ??
  '';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
