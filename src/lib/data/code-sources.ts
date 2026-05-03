/**
 * Reader for the `code_sources` registry, Convex-backed. The start-run
 * form's source dropdown and the stage-card's "Inputs" rendering both
 * derive labels from this list.
 *
 * Mutations live client-side via `useMutation(api.sources.createCode)` /
 * `useMutation(api.sources.removeCode)` — see `sources-card.tsx`.
 */

import { connection } from 'next/server';
import { fetchQueryAsUser } from '@/lib/convex/server';
import { api } from '../../../convex/_generated/api';

export type CodeSourceRow = { slug: string; name: string; createdAt: number };

export async function listCodeSources(): Promise<CodeSourceRow[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.sources.listCode);
  return rows.map((r) => ({ slug: r.slug, name: r.name, createdAt: r.createdAt }));
}
