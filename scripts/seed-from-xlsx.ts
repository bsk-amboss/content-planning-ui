/**
 * Seed Convex ontology tables (ICD-10, HCUP, ABIM, Orpha) from xlsx fixtures.
 *
 *   pnpm db:seed
 *
 * Per-specialty: clears the four ontology tables in Convex, re-inserts in
 * 100-row chunks (well under the 4 MiB/s free-tier write cap). Uses the same
 * xlsx repository the editor seed reads from.
 *
 * Editor data (codes/articles/sections/categories) lives in Convex and is
 * seeded via `pnpm seed:convex`. Milestones via `pnpm db:import-milestones`.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { env } from '@/env';
import { createXlsxRepos } from '@/lib/repositories/xlsx/repos';
import { api } from '../convex/_generated/api';

const CHUNK = 100;
const THROTTLE_MS = 250;

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

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
}

async function main() {
  if (!env.NEXT_PUBLIC_CONVEX_URL) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');

  const fixtures = parseFixturesEnv();
  if (fixtures.length === 0) {
    console.error('No xlsx fixtures found. Nothing to seed.');
    process.exit(1);
  }

  const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  const xlsxRepos = createXlsxRepos(fixtures);

  for (const fx of fixtures) {
    console.log(
      `\n→ Seeding "${fx.slug}" from ${path.relative(process.cwd(), fx.xlsxPath)}`,
    );

    const [icd10, hcup, abim, orpha] = await Promise.all([
      xlsxRepos.sources.icd10(fx.slug),
      xlsxRepos.sources.hcup(fx.slug),
      xlsxRepos.sources.abim(fx.slug),
      xlsxRepos.sources.orpha(fx.slug),
    ]);

    await Promise.all([
      convex.mutation(api.ontology.clearIcd10ForSpecialty, { slug: fx.slug }),
      convex.mutation(api.ontology.clearHcupForSpecialty, { slug: fx.slug }),
      convex.mutation(api.ontology.clearAbimForSpecialty, { slug: fx.slug }),
      convex.mutation(api.ontology.clearOrphaForSpecialty, { slug: fx.slug }),
    ]);

    if (icd10.length)
      await chunked(icd10, CHUNK, (chunk) =>
        convex.mutation(api.ontology.bulkInsertIcd10, { slug: fx.slug, rows: chunk }),
      );
    if (hcup.length)
      await chunked(hcup, CHUNK, (chunk) =>
        convex.mutation(api.ontology.bulkInsertHcup, { slug: fx.slug, rows: chunk }),
      );
    if (abim.length)
      await chunked(abim, CHUNK, (chunk) =>
        convex.mutation(api.ontology.bulkInsertAbim, {
          slug: fx.slug,
          rows: chunk.map((r) => ({
            abimIndex: r.Index,
            primaryCategory: r.primaryCategory,
            secondaryCategory: r.secondaryCategory,
            tertiaryCategory: r.tertiaryCategory,
            disease: r.disease,
            specialty: r.Specialty,
            code: r.code,
            item: r.item,
            choice: r.choice,
            category: r.category,
            count: r.count,
          })),
        }),
      );
    if (orpha.length)
      await chunked(orpha, CHUNK, (chunk) =>
        convex.mutation(api.ontology.bulkInsertOrpha, {
          slug: fx.slug,
          rows: chunk.map((r) => ({
            orphaCode: r.orphaCode,
            parentOrphaCode: r.parentOrphaCode,
            specificName: r.specificName,
            parentCategory: r.parentCategory,
            orphaTargetFilenamesToInclude: r.orphaTargetFilenamesToInclude,
            icd10LettersToInclude: r.icd10lettersToInclude,
            count: r.count,
          })),
        }),
      );

    const counts: Array<[string, number]> = [
      ['icd10_codes', icd10.length],
      ['hcup_codes', hcup.length],
      ['abim_codes', abim.length],
      ['orpha_codes', orpha.length],
    ];
    for (const [name, count] of counts) {
      if (count > 0) console.log(`   ${name.padEnd(20)} ${count.toLocaleString()}`);
    }
  }

  console.log('\n✓ Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
