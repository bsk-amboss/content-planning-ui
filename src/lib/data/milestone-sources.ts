/**
 * Cached reader + mutators for the `milestone_sources` registry.
 *
 * Parallels `code-sources.ts` but under the `milestone-sources` cache tag so
 * the two dropdowns invalidate independently. The start-milestones form and
 * the milestone stage-card rendering both derive labels from this list.
 */

import { asc, eq } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { milestoneSources } from '@/lib/db/schema';

export type MilestoneSourceRow = typeof milestoneSources.$inferSelect;

export async function listMilestoneSources(): Promise<MilestoneSourceRow[]> {
  'use cache';
  cacheTag('milestone-sources');
  cacheLife('minutes');
  const db = getDb();
  return db.select().from(milestoneSources).orderBy(asc(milestoneSources.name));
}

export async function createMilestoneSource(input: {
  slug: string;
  name: string;
}): Promise<MilestoneSourceRow> {
  const db = getDb();
  const [row] = await db
    .insert(milestoneSources)
    .values({ slug: input.slug, name: input.name })
    .returning();
  return row;
}

export async function deleteMilestoneSource(slug: string): Promise<void> {
  const db = getDb();
  await db.delete(milestoneSources).where(eq(milestoneSources.slug, slug));
}
