/**
 * Seed Postgres from local xlsx fixtures.
 *
 * Reads the same fixture registry the repositories layer uses, parses every tab
 * via the existing xlsx repos, and writes rows into Neon via Drizzle. Idempotent
 * per specialty: rows are deleted + re-inserted.
 *
 * Run with: npm run db:seed
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  abimToRow,
  articleSuggestionToRow,
  codeCategoryToRow,
  codeToRow,
  consolidatedArticleToRow,
  consolidatedSectionToRow,
  icdToRow,
  orphaToRow,
  statsToRow,
} from '@/lib/db/mappers';
import {
  abimCodes,
  articleUpdateSuggestions,
  codeCategories,
  codes,
  consolidatedArticles,
  consolidatedSections,
  hcupCodes,
  icd10Codes,
  newArticleSuggestions,
  orphaCodes,
  specialties as specialtiesTable,
  specialtyStats,
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

    // Upsert specialty. Child rows cascade on delete, so we clear them by FK below
    // rather than deleting the specialty row (which would also drop the FK target).
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

    // Clear child rows for this specialty.
    const childTables = [
      codes,
      codeCategories,
      consolidatedArticles,
      consolidatedSections,
      newArticleSuggestions,
      articleUpdateSuggestions,
      icd10Codes,
      hcupCodes,
      abimCodes,
      orphaCodes,
    ] as const;
    for (const t of childTables) {
      await db.delete(t).where(eq(t.specialtySlug, fx.slug));
    }
    await db.delete(specialtyStats).where(eq(specialtyStats.specialtySlug, fx.slug));

    // --- Fetch + map + insert -------------------------------------------------
    const [
      codeList,
      catList,
      consArticles,
      consSections,
      newArticles,
      updateArticles,
      icd10,
      hcup,
      abim,
      orpha,
      stats,
    ] = await Promise.all([
      xlsxRepos.codes.list(fx.slug),
      xlsxRepos.categories.list(fx.slug),
      xlsxRepos.articles.listConsolidated(fx.slug),
      xlsxRepos.sections.listConsolidated(fx.slug),
      xlsxRepos.articles.listNew(fx.slug),
      xlsxRepos.articles.listUpdates(fx.slug),
      xlsxRepos.sources.icd10(fx.slug),
      xlsxRepos.sources.hcup(fx.slug),
      xlsxRepos.sources.abim(fx.slug),
      xlsxRepos.sources.orpha(fx.slug),
      xlsxRepos.stats.get(fx.slug),
    ]);

    const results: Array<[string, number]> = [];

    if (codeList.length) {
      await insertInBatches(
        codeList.map((c) => codeToRow(c, fx.slug)),
        (chunk) => db.insert(codes).values(chunk),
      );
      results.push(['codes', codeList.length]);
    }

    if (catList.length) {
      await insertInBatches(
        catList.map((c) => codeCategoryToRow(c, fx.slug)),
        (chunk) => db.insert(codeCategories).values(chunk),
      );
      results.push(['code_categories', catList.length]);
    }

    if (consArticles.length) {
      await insertInBatches(
        consArticles.map((a) => consolidatedArticleToRow(a, fx.slug)),
        (chunk) => db.insert(consolidatedArticles).values(chunk),
      );
      results.push(['consolidated_articles', consArticles.length]);
    }

    if (consSections.length) {
      await insertInBatches(
        consSections.map((s) => consolidatedSectionToRow(s, fx.slug)),
        (chunk) => db.insert(consolidatedSections).values(chunk),
      );
      results.push(['consolidated_sections', consSections.length]);
    }

    if (newArticles.length) {
      await insertInBatches(
        newArticles.map((a) => articleSuggestionToRow(a, fx.slug)),
        (chunk) => db.insert(newArticleSuggestions).values(chunk),
      );
      results.push(['new_article_suggestions', newArticles.length]);
    }

    if (updateArticles.length) {
      await insertInBatches(
        updateArticles.map((a) => articleSuggestionToRow(a, fx.slug)),
        (chunk) => db.insert(articleUpdateSuggestions).values(chunk),
      );
      results.push(['article_update_suggestions', updateArticles.length]);
    }

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

    await db.insert(specialtyStats).values(statsToRow(stats, fx.slug));

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
