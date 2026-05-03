/**
 * Reader + mutators for the `code_sources` registry, Convex-backed.
 * The start-run form's source dropdown and the stage-card's "Inputs"
 * rendering both derive labels from this list.
 */

import { connection } from 'next/server';
import { fetchMutationAsUser, fetchQueryAsUser } from '@/lib/convex/server';
import { api } from '../../../convex/_generated/api';

export type CodeSourceRow = { slug: string; name: string; createdAt: number };

export async function listCodeSources(): Promise<CodeSourceRow[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.sources.listCode);
  return rows.map((r) => ({ slug: r.slug, name: r.name, createdAt: r.createdAt }));
}

export async function createCodeSource(input: {
  slug: string;
  name: string;
}): Promise<CodeSourceRow> {
  await fetchMutationAsUser(api.sources.createCode, {
    slug: input.slug,
    name: input.name,
  });
  return { slug: input.slug, name: input.name, createdAt: Date.now() };
}

export async function deleteCodeSource(slug: string): Promise<void> {
  await fetchMutationAsUser(api.sources.removeCode, { slug });
}
