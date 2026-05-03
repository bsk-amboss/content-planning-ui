/**
 * Reader for the `milestone_sources` registry, Convex-backed. Parallels
 * `code-sources.ts`. The start-milestones form and the milestone
 * stage-card rendering both derive labels from this list.
 *
 * Mutations live client-side via `useMutation(api.sources.createMilestone)` /
 * `useMutation(api.sources.removeMilestone)` — see `sources-card.tsx`.
 */

import { connection } from 'next/server';
import { fetchQueryAsUser } from '@/lib/convex/server';
import { api } from '../../../convex/_generated/api';

export type MilestoneSourceRow = { slug: string; name: string; createdAt: number };

export async function listMilestoneSources(): Promise<MilestoneSourceRow[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.sources.listMilestone);
  return rows.map((r) => ({ slug: r.slug, name: r.name, createdAt: r.createdAt }));
}
