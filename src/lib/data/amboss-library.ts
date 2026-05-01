/**
 * Lookups for the AMBOSS article/section catalog (Convex-backed).
 *
 * The mapping workflow validates every cited ID against these sets. Convex
 * caches its own queries, so we no longer wrap with Next.js `'use cache'`.
 */

import { fetchQuery } from 'convex/nextjs';
import { connection } from 'next/server';
import { api } from '../../../convex/_generated/api';

export type AmbossLibraryStats = {
  articles: number;
  sections: number;
  lastSyncedAt: Date | null;
};

export async function listAmbossArticleIds(): Promise<Set<string>> {
  await connection();
  const ids = await fetchQuery(api.amboss.listArticleIds);
  return new Set(ids);
}

export async function listAmbossSectionIds(): Promise<Set<string>> {
  await connection();
  const ids = await fetchQuery(api.amboss.listSectionIds);
  return new Set(ids);
}

export async function getAmbossLibraryStats(): Promise<AmbossLibraryStats> {
  await connection();
  const s = await fetchQuery(api.amboss.stats);
  return {
    articles: s.articles,
    sections: s.sections,
    lastSyncedAt: s.lastSyncedAt ? new Date(s.lastSyncedAt) : null,
  };
}
