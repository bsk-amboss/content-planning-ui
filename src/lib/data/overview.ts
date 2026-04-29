import { eq, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import {
  codeCategories,
  codes,
  consolidatedArticles,
  consolidatedSections,
  newArticleSuggestions,
  specialtyStats,
} from '@/lib/db/schema';

export interface OverviewCounts {
  codes: number;
  mappedCodes: number;
  categories: number;
  consolidatedArticles: number;
  newArticles: number;
  consolidatedSections: number;
  totalCodes?: number;
  completedMappings?: number;
}

/**
 * Single round-trip of count(*) queries powering the specialty overview cards.
 * Replaces a previous implementation that fetched every row from six tables
 * just to call `.length`. `mappedCodes` matches the legacy semantics (rows
 * whose `coverage_level` is one of the allowlisted COVERAGE_LEVELS strings).
 */
export async function getOverviewCounts(slug: string): Promise<OverviewCounts> {
  'use cache';
  cacheTag(
    `specialty:${slug}`,
    `codes:${slug}`,
    `categories:${slug}`,
    `articles:${slug}`,
    `sections:${slug}`,
    `stats:${slug}`,
  );
  cacheLife('minutes');
  const db = getDb();

  const [codesRow, categoriesN, articlesN, newArticlesN, sectionsN, statsRow] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          mapped: sql<number>`count(*) filter (where ${codes.coverageLevel} in ('none','student','early-resident','advanced-resident','attending','specialist'))::int`,
        })
        .from(codes)
        .where(eq(codes.specialtySlug, slug))
        .then((rows) => rows[0] ?? { total: 0, mapped: 0 }),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(codeCategories)
        .where(eq(codeCategories.specialtySlug, slug))
        .then((rows) => rows[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(consolidatedArticles)
        .where(eq(consolidatedArticles.specialtySlug, slug))
        .then((rows) => rows[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(newArticleSuggestions)
        .where(eq(newArticleSuggestions.specialtySlug, slug))
        .then((rows) => rows[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(consolidatedSections)
        .where(eq(consolidatedSections.specialtySlug, slug))
        .then((rows) => rows[0]?.n ?? 0),
      db
        .select({
          totalCodes: specialtyStats.totalCodes,
          completedMappings: specialtyStats.completedMappings,
        })
        .from(specialtyStats)
        .where(eq(specialtyStats.specialtySlug, slug))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

  return {
    codes: codesRow.total,
    mappedCodes: codesRow.mapped,
    categories: categoriesN,
    consolidatedArticles: articlesN,
    newArticles: newArticlesN,
    consolidatedSections: sectionsN,
    totalCodes: statsRow?.totalCodes ?? undefined,
    completedMappings: statsRow?.completedMappings ?? undefined,
  };
}
