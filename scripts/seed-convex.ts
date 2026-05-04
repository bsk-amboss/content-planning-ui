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
    // `metadata`, `index`). Blob fields are typed arrays now (Phase B2) —
    // no JSON.stringify boundary. The xlsx fixtures still carry the LLM's
    // `record<title, id>` shape inside `articlesWhereCoverageIs[].sections`;
    // normalise to array form so the validator accepts it (mirrors the
    // workflow-side normaliser in `src/lib/workflows/lib/db-writes.ts`).
    const codeRows = codes.map(
      ({ index: _i, fullJsonOutput: _fj, metadata: _md, ...rest }) =>
        normaliseCodeMappingShape(stripUndef(rest)),
    );
    const categoryRows = categories.map((r) => stripUndef(r));
    const consolidatedRows = consolidatedArticles.map(({ index: _i, ...r }) =>
      stripUndef(r),
    );
    const newRows = newArticles.map(({ index: _i, ...r }) => stripUndef(r));
    const updateRows = updateArticles.map(({ index: _i, ...r }) => stripUndef(r));
    const sectionRows = sections.map(({ index: _i, ...r }) => stripUndef(r));

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

type Anyish = Record<string, unknown>;

function pickStr(o: Anyish, k: string): string | undefined {
  const v = o[k];
  return typeof v === 'string' ? v : undefined;
}
function pickNum(o: Anyish, k: string): number | undefined {
  const v = o[k];
  return typeof v === 'number' ? v : undefined;
}
function pickBool(o: Anyish, k: string): boolean | undefined {
  const v = o[k];
  return typeof v === 'boolean' ? v : undefined;
}

/**
 * The xlsx fixtures hold the original LLM output for these blobs (parsed via
 * Zod `.passthrough()`), so they may carry extra keys and the LLM's
 * `record<title, id>` form for `coveredSections.sections`. Convex's typed
 * validators are strict: extra keys are rejected. This cleaner trims each
 * entry down to the validator-allowed shape and converts the record-form
 * sections to array form (mirroring `normaliseCoveredSections` in
 * `src/lib/workflows/lib/db-writes.ts`).
 *
 * The workflow path doesn't need this — Zod's default `.parse()` on the
 * `MappingOutputSchema` already strips unknown keys.
 */
function normaliseCodeMappingShape<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  if (Array.isArray(row.articlesWhereCoverageIs)) {
    out.articlesWhereCoverageIs = (row.articlesWhereCoverageIs as Anyish[]).map((b) => {
      const s = b.sections;
      let sections: Array<{ sectionTitle?: string; sectionId?: string }> | undefined;
      if (Array.isArray(s)) {
        sections = s.map((entry) => {
          const o = (entry ?? {}) as Anyish;
          return {
            sectionTitle: pickStr(o, 'sectionTitle'),
            sectionId: pickStr(o, 'sectionId'),
          };
        });
      } else if (s && typeof s === 'object') {
        sections = Object.entries(s as Anyish).map(([title, id]) => ({
          sectionTitle: title,
          sectionId: typeof id === 'string' ? id : undefined,
        }));
      }
      return {
        articleTitle: pickStr(b, 'articleTitle'),
        articleId: pickStr(b, 'articleId'),
        sections,
      };
    });
  }
  if (Array.isArray(row.existingArticleUpdates)) {
    out.existingArticleUpdates = (row.existingArticleUpdates as Anyish[]).map((b) => ({
      articleTitle: pickStr(b, 'articleTitle'),
      articleId: pickStr(b, 'articleId'),
      sections: Array.isArray(b.sections)
        ? (b.sections as Anyish[]).map((s) => ({
            sectionTitle: pickStr(s, 'sectionTitle'),
            sectionId: pickStr(s, 'sectionId'),
            exists: pickBool(s, 'exists'),
            changes: pickStr(s, 'changes'),
            importance: pickNum(s, 'importance'),
          }))
        : undefined,
    }));
  }
  if (Array.isArray(row.newArticlesNeeded)) {
    out.newArticlesNeeded = (row.newArticlesNeeded as Anyish[]).map((b) => ({
      articleTitle: pickStr(b, 'articleTitle'),
      importance: pickNum(b, 'importance'),
    }));
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
