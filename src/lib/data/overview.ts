import { fetchQuery } from 'convex/nextjs';
import { eq } from 'drizzle-orm';
import { connection } from 'next/server';
import { getDb } from '@/lib/db';
import { specialtyStats } from '@/lib/db/schema';
import { api } from '../../../convex/_generated/api';

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
 * Specialty overview counts, pulled in parallel from Convex (live editor data)
 * and Postgres (specialty_stats stays on Postgres because it's a derived
 * snapshot written by the workflow rollup). Replaces six count(*) Drizzle
 * queries; the editor counts now reflect the same source of truth the codes/
 * articles/sections tabs render from.
 */
export async function getOverviewCounts(slug: string): Promise<OverviewCounts> {
  await connection();
  const db = getDb();
  const [convexCounts, statsRow] = await Promise.all([
    fetchQuery(api.overview.counts, { slug }),
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
    ...convexCounts,
    totalCodes: statsRow?.totalCodes ?? undefined,
    completedMappings: statsRow?.completedMappings ?? undefined,
  };
}
