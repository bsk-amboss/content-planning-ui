/**
 * Refresh the local AMBOSS article/section catalog used by the mapping
 * workflow to validate cited IDs.
 *
 *   npm run db:refresh-amboss-library -- path/to/export.json
 *
 * Expected JSON shape (the user's previous BigQuery → JSON export; if the
 * real file differs, adapt this loader):
 *
 *   {
 *     "articles": [{"id": "TyX6e00", "title": "...", "contentBase": "US"?}],
 *     "sections": [{"id": "EmW8hN0", "articleId": "TyX6e00", "title": "..."}]
 *   }
 *
 * Upserts are idempotent. Rows missing from the export stay in the DB unless
 * `--prune` is passed, in which case anything not in the current export is
 * deleted. Calls `/api/internal/revalidate` at the end so the cached ID sets
 * pick up the refresh on the next read.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notInArray, sql } from 'drizzle-orm';
import { getDb } from '../src/lib/db';
import { ambossArticles, ambossSections } from '../src/lib/db/schema';

type RawArticle = { id: string; title: string; contentBase?: string };
type RawSection = { id: string; articleId: string; title: string };

type ExportShape = {
  articles: RawArticle[];
  sections: RawSection[];
};

const UPSERT_CHUNK = 500;

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function revalidate(): Promise<void> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');
  try {
    const res = await fetch(`${base}/api/internal/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tags: ['amboss-library'],
        secret: process.env.INTERNAL_REVALIDATE_SECRET,
      }),
    });
    if (!res.ok) {
      console.warn(`[refresh] revalidate returned ${res.status}; cache may be stale`);
    }
  } catch (e) {
    console.warn(
      `[refresh] revalidate failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const prune = args.includes('--prune');
  const pathArg = args.find((a) => !a.startsWith('--'));
  if (!pathArg) {
    console.error(
      'usage: npm run db:refresh-amboss-library -- path/to/export.json [--prune]',
    );
    process.exit(1);
  }
  const absPath = resolve(process.cwd(), pathArg);
  console.log(`[refresh] reading ${absPath}`);
  const exp = readExport(absPath);
  console.log(
    `[refresh] ${exp.articles.length} articles, ${exp.sections.length} sections`,
  );

  const db = getDb();
  const now = new Date();

  // Upsert articles in chunks.
  for (const batch of chunk(exp.articles, UPSERT_CHUNK)) {
    await db
      .insert(ambossArticles)
      .values(
        batch.map((a) => ({
          id: a.id,
          title: a.title,
          contentBase: a.contentBase ?? null,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: ambossArticles.id,
        set: {
          title: sql`excluded.title`,
          contentBase: sql`excluded.content_base`,
          updatedAt: now,
        },
      });
  }

  // Upsert sections in chunks.
  for (const batch of chunk(exp.sections, UPSERT_CHUNK)) {
    await db
      .insert(ambossSections)
      .values(
        batch.map((s) => ({
          id: s.id,
          articleId: s.articleId,
          title: s.title,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: ambossSections.id,
        set: {
          articleId: sql`excluded.article_id`,
          title: sql`excluded.title`,
          updatedAt: now,
        },
      });
  }

  if (prune) {
    const keepArticles = new Set(exp.articles.map((a) => a.id));
    const keepSections = new Set(exp.sections.map((s) => s.id));
    const deletedSections = await db
      .delete(ambossSections)
      .where(notInArray(ambossSections.id, [...keepSections]))
      .returning({ id: ambossSections.id });
    const deletedArticles = await db
      .delete(ambossArticles)
      .where(notInArray(ambossArticles.id, [...keepArticles]))
      .returning({ id: ambossArticles.id });
    console.log(
      `[refresh] pruned ${deletedArticles.length} articles + ${deletedSections.length} sections`,
    );
  }

  await revalidate();
  console.log('[refresh] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
