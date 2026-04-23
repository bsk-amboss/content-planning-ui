/**
 * Cached lookups for the AMBOSS article/section catalog.
 *
 * The mapping workflow validates every cited ID against these sets. The
 * underlying tables are refreshed out-of-band via
 * `scripts/refresh-amboss-library.ts`; the `amboss-library` cache tag flushes
 * every reader after a refresh.
 */

import { desc } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { ambossArticles, ambossSections } from '@/lib/db/schema';

export type AmbossLibraryStats = {
  articles: number;
  sections: number;
  lastSyncedAt: Date | null;
};

export async function listAmbossArticleIds(): Promise<Set<string>> {
  'use cache';
  cacheTag('amboss-library');
  cacheLife('hours');
  const db = getDb();
  const rows = await db.select({ id: ambossArticles.id }).from(ambossArticles);
  return new Set(rows.map((r) => r.id));
}

export async function listAmbossSectionIds(): Promise<Set<string>> {
  'use cache';
  cacheTag('amboss-library');
  cacheLife('hours');
  const db = getDb();
  const rows = await db.select({ id: ambossSections.id }).from(ambossSections);
  return new Set(rows.map((r) => r.id));
}

export async function getAmbossLibraryStats(): Promise<AmbossLibraryStats> {
  'use cache';
  cacheTag('amboss-library');
  cacheLife('hours');
  const db = getDb();
  const articleCount = await db.$count(ambossArticles);
  const sectionCount = await db.$count(ambossSections);
  const [latest] = await db
    .select({ updatedAt: ambossArticles.updatedAt })
    .from(ambossArticles)
    .orderBy(desc(ambossArticles.updatedAt))
    .limit(1);
  return {
    articles: articleCount,
    sections: sectionCount,
    lastSyncedAt: latest?.updatedAt ?? null,
  };
}
