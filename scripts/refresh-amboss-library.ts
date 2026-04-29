/**
 * Refresh the local AMBOSS article/section catalog used by the mapping
 * workflow to validate cited IDs.
 *
 *   pnpm db:refresh-amboss-library -- path/to/export.json
 *   pnpm db:refresh-amboss-library -- path/to/export.json --prune
 *
 * Expected JSON shape (the user's previous BigQuery → JSON export; if the
 * real file differs, adapt this loader):
 *
 *   {
 *     "articles": [{"id": "TyX6e00", "title": "...", "contentBase": "US"?}],
 *     "sections": [{"id": "EmW8hN0", "articleId": "TyX6e00", "title": "..."}]
 *   }
 *
 * Upserts are idempotent. `--prune` deletes Convex rows whose updatedAt is
 * older than this run's timestamp (i.e. anything not in the current export).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { env } from '@/env';
import { api } from '../convex/_generated/api';

type RawArticle = { id: string; title: string; contentBase?: string };
type RawSection = { id: string; articleId: string; title: string };
type ExportShape = { articles: RawArticle[]; sections: RawSection[] };

const UPSERT_CHUNK = 200;
const THROTTLE_MS = 250;

function readExport(path: string): ExportShape {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('articles' in parsed) ||
    !('sections' in parsed)
  ) {
    throw new Error(`export file at ${path} is missing 'articles' or 'sections' keys`);
  }
  const exp = parsed as ExportShape;
  if (!Array.isArray(exp.articles) || !Array.isArray(exp.sections)) {
    throw new Error('articles/sections must be arrays');
  }
  return exp;
}

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const prune = args.includes('--prune');
  const pathArg = args.find((a) => !a.startsWith('--'));
  if (!pathArg) {
    console.error(
      'usage: pnpm db:refresh-amboss-library -- path/to/export.json [--prune]',
    );
    process.exit(1);
  }
  if (!env.NEXT_PUBLIC_CONVEX_URL) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');

  const absPath = resolve(process.cwd(), pathArg);
  console.log(`[refresh] reading ${absPath}`);
  const exp = readExport(absPath);
  console.log(
    `[refresh] ${exp.articles.length} articles, ${exp.sections.length} sections`,
  );

  const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  const updatedAt = Date.now();

  await chunked(exp.articles, UPSERT_CHUNK, (chunk) =>
    convex.mutation(api.amboss.upsertArticles, {
      rows: chunk.map((a) => ({
        articleId: a.id,
        title: a.title,
        contentBase: a.contentBase,
      })),
      updatedAt,
    }),
  );
  await chunked(exp.sections, UPSERT_CHUNK, (chunk) =>
    convex.mutation(api.amboss.upsertSections, {
      rows: chunk.map((s) => ({
        sectionId: s.id,
        articleId: s.articleId,
        title: s.title,
      })),
      updatedAt,
    }),
  );

  if (prune) {
    const result = await convex.mutation(api.amboss.pruneOlderThan, { updatedAt });
    console.log(`[refresh] pruned ${result.pruned} stale rows`);
  }

  console.log('[refresh] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
