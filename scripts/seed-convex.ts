/**
 * One-shot seed: copies the editor-facing tables from xlsx fixtures into
 * Convex. Reads xlsx directly via the xlsx repository — no Postgres step.
 *
 *   npm run seed:convex
 *
 * Idempotent: clears each Convex table for the specialty before re-inserting.
 *
 * Milestones (`specialties.milestones`) are NOT seeded here — run
 * `npm run import-milestones -- <slug> <file>` separately.
 */

import { api } from '../convex/_generated/api';
import { convexClient } from './_lib/convex';
import { buildXlsxRegistry, createXlsxRepos } from './_lib/xlsx';

async function main() {
  const registry = buildXlsxRegistry();
  if (registry.length === 0) {
    throw new Error(
      'No xlsx fixtures discovered. Drop a `<slug>_mapping.xlsx` at the repo root, or set LOCAL_XLSX_FIXTURES.',
    );
  }

  const convex = convexClient();
  const repos = createXlsxRepos(registry);

  console.log('seeding specialties …');
  const specialties = await repos.specialties.list();
  for (const s of specialties) {
    await convex.mutation(api.specialties.create, {
      slug: s.slug,
      name: s.name,
      source: s.source,
      xlsxPath: s.xlsxPath,
    });
  }
  console.log(`  ${specialties.length} specialties`);

  for (const s of specialties) {
    const slug = s.slug;
    console.log(`seeding ${slug} …`);

    await Promise.all([
      convex.mutation(api.codes.deleteForSpecialty, { slug }),
      convex.mutation(api.categories.deleteForSpecialty, { slug }),
      convex.mutation(api.articles.deleteConsolidatedForSpecialty, { slug }),
      convex.mutation(api.articles.deleteNewForSpecialty, { slug }),
      convex.mutation(api.articles.deleteUpdatesForSpecialty, { slug }),
      convex.mutation(api.sections.deleteForSpecialty, { slug }),
    ]);

    const [
      codes,
      categories,
      consolidatedArticles,
      newArticles,
      updateArticles,
      sections,
    ] = await Promise.all([
      repos.codes.list(slug),
      repos.categories.list(slug),
      repos.articles.listConsolidated(slug),
      repos.articles.listNew(slug),
      repos.articles.listUpdates(slug),
      repos.sections.listConsolidated(slug),
    ]);

    // Pre-trim fields the Convex schema doesn't carry (`fullJsonOutput`,
    // `metadata`, `index`) and stringify blob fields whose nested keys may
    // contain unicode (Convex requires ASCII-only field names).
    const codeRows = codes.map(
      ({ index: _i, fullJsonOutput: _fj, metadata: _md, ...rest }) =>
        stringifyBlobs(stripUndef(rest), [
          'articlesWhereCoverageIs',
          'existingArticleUpdates',
          'newArticlesNeeded',
        ]),
    );
    const categoryRows = categories.map((r) => stripUndef(r));
    const consolidatedRows = consolidatedArticles.map(({ index: _i, ...r }) =>
      stringifyBlobs(stripUndef(r), ['codes']),
    );
    const newRows = newArticles.map(({ index: _i, ...r }) =>
      stringifyBlobs(stripUndef(r), ['codes']),
    );
    const updateRows = updateArticles.map(({ index: _i, ...r }) =>
      stringifyBlobs(stripUndef(r), ['codes']),
    );
    const sectionRows = sections.map(({ index: _i, ...r }) =>
      stringifyBlobs(stripUndef(r), ['codes']),
    );

    if (codeRows.length)
      await chunked(codeRows, 25, (chunk) =>
        convex.mutation(api.codes.bulkInsert, { slug, rows: chunk }),
      );
    if (categoryRows.length)
      await chunked(categoryRows, 25, (chunk) =>
        convex.mutation(api.categories.bulkInsert, { slug, rows: chunk }),
      );
    if (consolidatedRows.length)
      await chunked(consolidatedRows, 25, (chunk) =>
        convex.mutation(api.articles.bulkInsertConsolidated, { slug, rows: chunk }),
      );
    if (newRows.length)
      await chunked(newRows, 25, (chunk) =>
        convex.mutation(api.articles.bulkInsertNew, { slug, rows: chunk }),
      );
    if (updateRows.length)
      await chunked(updateRows, 25, (chunk) =>
        convex.mutation(api.articles.bulkInsertUpdates, { slug, rows: chunk }),
      );
    if (sectionRows.length)
      await chunked(sectionRows, 25, (chunk) =>
        convex.mutation(api.sections.bulkInsert, { slug, rows: chunk }),
      );

    console.log(
      `  codes=${codeRows.length} categories=${categoryRows.length} ` +
        `articles=${consolidatedRows.length}+${newRows.length}+${updateRows.length} ` +
        `sections=${sectionRows.length}`,
    );
  }

  console.log('done.');
}

function stripUndef<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

function stringifyBlobs<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
  const out: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    const v = out[f];
    if (v !== undefined && v !== null && typeof v !== 'string') {
      out[f] = JSON.stringify(v);
    }
  }
  return out as T;
}

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
    // Throttle to stay under the free-tier write-rate cap (4 MiB/s).
    await new Promise((r) => setTimeout(r, 250));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
