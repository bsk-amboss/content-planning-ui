import { and, eq, isNull, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { codes } from '@/lib/db/schema';
import { getRepositories } from '@/lib/repositories';

export async function listCodes(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `codes:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.codes.list(slug);
}

/**
 * How many codes for this specialty haven't been mapped yet (`is_in_amboss
 * IS NULL`). Drives the "N unmapped codes" label on the mapping CTA.
 */
export async function listUnmappedCodeCount(slug: string): Promise<number> {
  'use cache';
  cacheTag(`codes:${slug}`);
  cacheLife('minutes');
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(codes)
    .where(and(eq(codes.specialtySlug, slug), isNull(codes.isInAmboss)));
  return row?.n ?? 0;
}

export type CodeCategorySummary = {
  category: string;
  total: number;
  unmapped: number;
};

export type UnmappedCodePickerRow = {
  code: string;
  description: string | null;
  category: string | null;
};

/**
 * Every unmapped code for a specialty with enough metadata to populate an
 * autocomplete. The map-codes form uses this to let the user pin a run to a
 * specific code by searching by code ID or description. Cached so repeat
 * page loads don't replay a large `SELECT`.
 */
export async function listUnmappedCodesForPicker(
  slug: string,
): Promise<UnmappedCodePickerRow[]> {
  'use cache';
  cacheTag(`codes:${slug}`);
  cacheLife('minutes');
  const db = getDb();
  const rows = await db
    .select({
      code: codes.code,
      description: codes.description,
      category: codes.category,
    })
    .from(codes)
    .where(and(eq(codes.specialtySlug, slug), isNull(codes.isInAmboss)))
    .orderBy(codes.code);
  return rows;
}

/**
 * Per-category code counts for a specialty — used by the Start-mapping form
 * to populate the multi-select dropdown and compute live totals as the user
 * narrows the filter. Uncategorized rows surface under the synthetic
 * `"(uncategorized)"` label so they remain selectable.
 */
export async function listCodeCategories(slug: string): Promise<CodeCategorySummary[]> {
  'use cache';
  cacheTag(`codes:${slug}`);
  cacheLife('minutes');
  const db = getDb();
  const rows = await db
    .select({
      category: sql<string>`COALESCE(${codes.category}, '(uncategorized)')`,
      total: sql<number>`count(*)::int`,
      unmapped: sql<number>`count(*) filter (where ${codes.isInAmboss} is null)::int`,
    })
    .from(codes)
    .where(eq(codes.specialtySlug, slug))
    .groupBy(sql`COALESCE(${codes.category}, '(uncategorized)')`)
    .orderBy(sql`COALESCE(${codes.category}, '(uncategorized)')`);
  return rows.map((r) => ({
    category: r.category,
    total: r.total,
    unmapped: r.unmapped,
  }));
}
