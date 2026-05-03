/**
 * Reader + mutators for the `milestone_sources` registry, Convex-backed.
 * Parallels `code-sources.ts`. The start-milestones form and the milestone
 * stage-card rendering both derive labels from this list.
 */

import { connection } from 'next/server';
import { fetchMutationAsUser, fetchQueryAsUser } from '@/lib/convex/server';
import { api } from '../../../convex/_generated/api';

export type MilestoneSourceRow = { slug: string; name: string; createdAt: number };

export async function listMilestoneSources(): Promise<MilestoneSourceRow[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.sources.listMilestone);
  return rows.map((r) => ({ slug: r.slug, name: r.name, createdAt: r.createdAt }));
}

export async function createMilestoneSource(input: {
  slug: string;
  name: string;
}): Promise<MilestoneSourceRow> {
  await fetchMutationAsUser(api.sources.createMilestone, {
    slug: input.slug,
    name: input.name,
  });
  return { slug: input.slug, name: input.name, createdAt: Date.now() };
}

export async function deleteMilestoneSource(slug: string): Promise<void> {
  await fetchMutationAsUser(api.sources.removeMilestone, { slug });
}
