/**
 * Quick sanity check that the DB has the expected rows.
 * Usage: dotenv -e .env.local -- tsx scripts/verify-db.ts
 */

import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

async function main() {
  const db = getDb();
  const tables = [
    'specialties',
    'codes',
    'code_categories',
    'consolidated_articles',
    'consolidated_sections',
    'new_article_suggestions',
    'article_update_suggestions',
    'icd10_codes',
    'hcup_codes',
    'abim_codes',
    'orpha_codes',
    'specialty_stats',
    'pipeline_runs',
    'pipeline_stages',
    'extracted_codes',
  ];
  for (const t of tables) {
    const result = await db.execute<{ count: string }>(
      sql.raw(`select count(*)::text as count from "${t}"`),
    );
    // neon-http returns an object with a rows array.
    const rows = (result as unknown as { rows: Array<{ count: string }> }).rows ?? result;
    const count = Array.isArray(rows) ? rows[0]?.count : undefined;
    console.log(`${t.padEnd(32)} ${count ?? '?'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
