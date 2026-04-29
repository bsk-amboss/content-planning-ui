/**
 * One-shot seed: copies the editor-facing tables from Postgres into Convex.
 * Run after `npx convex dev` has provisioned the deployment so the env vars
 * and codegen are in place.
 *
 *   pnpm seed:convex
 *
 * Idempotent: clears each Convex table for the specialty before re-inserting,
 * since this is the bootstrap step (current data is wipeable per the plan).
 */
import { ConvexHttpClient } from 'convex/browser';
import { env } from '@/env';
import { getDb } from '@/lib/db';
import { getRepositories } from '@/lib/repositories';
import { api } from '../convex/_generated/api';

async function main() {
  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error(
      'NEXT_PUBLIC_CONVEX_URL is not set — run `npx convex dev` once to provision the deployment.',
    );
  }

  const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  const { repos } = getRepositories();
  // Touch the Drizzle client so a missing DATABASE_URL fails fast.
  void getDb();

  console.log('seeding specialties …');
  const specialties = await repos.specialties.list();
  for (const s of specialties) {
    await convex.mutation(api.specialties.create, {
      slug: s.slug,
      name: s.name,
      source: s.source,
      sheetId: s.sheetId,
      xlsxPath: s.xlsxPath,
    });
  }
  console.log(`  ${specialties.length} specialties`);

  for (const s of specialties) {
    const slug = s.slug;
    console.log(`seeding ${slug} …`);

    // Clear-and-reinsert per specialty so re-running the script converges.
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

    // The Drizzle types include a few fields we explicitly pre-trimmed from
    // the Convex schemas (notably `fullJsonOutput`, `metadata`, `index`).
    // Strip them here so the Convex validator accepts the payload.
    //
    // Blob fields with user-content keys (section titles, etc.) need to be
    // JSON-stringified before insert because Convex requires ASCII-only
    // field names — see schema.ts comment.
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
    // Throttle to stay under the free-tier write-rate cap (4 MiB/s). With
    // chunks of ~25 rows × tens of KB this keeps us comfortably below.
    await new Promise((r) => setTimeout(r, 250));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
