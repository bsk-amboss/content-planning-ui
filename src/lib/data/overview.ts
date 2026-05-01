import { fetchQuery } from 'convex/nextjs';
import { connection } from 'next/server';
import { api } from '../../../convex/_generated/api';

export interface OverviewCounts {
  codes: number;
  mappedCodes: number;
  categories: number;
  consolidatedArticles: number;
  newArticles: number;
  consolidatedSections: number;
}

/**
 * Specialty overview counts, pulled from Convex (live editor data). The legacy
 * `specialty_stats` Postgres rollup was an xlsx-derived snapshot from before
 * the migration; nothing populates it post-migration, so it's gone.
 */
export async function getOverviewCounts(slug: string): Promise<OverviewCounts> {
  await connection();
  return await fetchQuery(api.overview.counts, { slug });
}
