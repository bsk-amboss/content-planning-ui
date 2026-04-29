/**
 * Seed Postgres ontology tables (ICD-10, HCUP, ABIM, Orpha) from xlsx fixtures.
 *
 * Editor data (codes/articles/sections/categories) lives in Convex now and is
 * seeded via `pnpm seed:convex`. The only reason this script still exists is to
 * populate the read-only ontology tables and keep the `specialties` row in
 * Postgres (it's the FK target for `pipeline_runs` and the ontology tables).
 *
 * Run with: pnpm db:seed
 *
 * Phase 2 of the Postgres-drop migration moves ontology to Convex; this script
 * is retired then.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { abimToRow, icdToRow, orphaToRow } from '@/lib/db/mappers';
import {
  abimCodes,
  hcupCodes,
  icd10Codes,
  orphaCodes,
  specialties as specialtiesTable,
} from '@/lib/db/schema';
import { createXlsxRepos } from '@/lib/repositories/xlsx/repos';

const BATCH = 300;

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/g)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function parseFixturesEnv(): Array<{ slug: string; name: string; xlsxPath: string }> {
  const out: Array<{ slug: string; name: string; xlsxPath: string }> = [];
  const raw = process.env.LOCAL_XLSX_FIXTURES ?? '';
  for (const pair of raw.split(',')) {
    const [slug, ...rest] = pair.split(':');
    const p = rest.join(':').trim();
    if (slug && p)
      out.push({ slug: slug.trim(), name: titleCase(slug.trim()), xlsxPath: p });
  }
  const defaultPath = path.join(process.cwd(), 'anesthesiology_mapping.xlsx');
  if (existsSync(defaultPath) && !out.some((e) => e.slug === 'anesthesiology')) {
    out.push({ slug: 'anesthesiology', name: 'Anesthesiology', xlsxPath: defaultPath });
  }
  return out;
}

async function insertInBatches<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await insert(chunk);
  }
}

async function main() {
  const fixtures = parseFixturesEnv();
  if (fixtures.length === 0) {
    console.error('No xlsx fixtures found. Nothing to seed.');
    process.exit(1);
  }

  const db = getDb();
  const xlsxRepos = createXlsxRepos(fixtures);

  for (const fx of fixtures) {
    console.log(
      `\n→ Seeding "${fx.slug}" from ${path.relative(process.cwd(), fx.xlsxPath)}`,
    );

    await db
      .insert(specialtiesTable)
      .values({
        slug: fx.slug,
        name: fx.name,
        source: 'xlsx',
        xlsxPath: fx.xlsxPath,
        lastSeededAt: new Date(),
      })
      .onConflictDoUpdate({
        target: specialtiesTable.slug,
        set: {
          name: fx.name,
          source: 'xlsx',
          xlsxPath: fx.xlsxPath,
          lastSeededAt: new Date(),
        },
      });

    for (const t of [icd10Codes, hcupCodes, abimCodes, orphaCodes] as const) {
      await db.delete(t).where(eq(t.specialtySlug, fx.slug));
    }

    const [icd10, hcup, abim, orpha] = await Promise.all([
      xlsxRepos.sources.icd10(fx.slug),
      xlsxRepos.sources.hcup(fx.slug),
      xlsxRepos.sources.abim(fx.slug),
      xlsxRepos.sources.orpha(fx.slug),
    ]);

    const results: Array<[string, number]> = [];
    if (icd10.length) {
      await insertInBatches(
        icd10.map((c) => icdToRow(c, fx.slug, icd10Codes)),
        (chunk) => db.insert(icd10Codes).values(chunk),
      );
      results.push(['icd10_codes', icd10.length]);
    }
    if (hcup.length) {
      await insertInBatches(
        hcup.map((c) => icdToRow(c, fx.slug, hcupCodes)),
        (chunk) => db.insert(hcupCodes).values(chunk),
      );
      results.push(['hcup_codes', hcup.length]);
    }
    if (abim.length) {
      await insertInBatches(
        abim.map((c) => abimToRow(c, fx.slug)),
        (chunk) => db.insert(abimCodes).values(chunk),
      );
      results.push(['abim_codes', abim.length]);
    }
    if (orpha.length) {
      await insertInBatches(
        orpha.map((c) => orphaToRow(c, fx.slug)),
        (chunk) => db.insert(orphaCodes).values(chunk),
      );
      results.push(['orpha_codes', orpha.length]);
    }

    for (const [name, count] of results) {
      console.log(`   ${name.padEnd(32)} ${count.toLocaleString()}`);
    }
  }

  console.log('\n✓ Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
