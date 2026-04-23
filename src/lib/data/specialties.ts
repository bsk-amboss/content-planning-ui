import { eq } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { specialties } from '@/lib/db/schema';
import { getRepositories } from '@/lib/repositories';

export type Backend = 'postgres' | 'sheets' | 'xlsx';

export async function listSpecialties() {
  'use cache';
  cacheTag('specialties');
  cacheLife('hours');
  const { repos } = getRepositories();
  return repos.specialties.list();
}

export async function getSpecialty(slug: string) {
  'use cache';
  cacheTag('specialties', `specialty:${slug}`);
  cacheLife('hours');
  const { repos } = getRepositories();
  return repos.specialties.get(slug);
}

/**
 * Approved milestones blob for a specialty. Lives on `specialties.milestones`
 * (plain text, written at the end of the extract-milestones workflow). Returns
 * `null` when the pipeline hasn't produced any yet.
 */
export async function getMilestones(slug: string): Promise<string | null> {
  'use cache';
  cacheTag(`specialty:${slug}`);
  cacheLife('minutes');
  const db = getDb();
  const [row] = await db
    .select({ milestones: specialties.milestones })
    .from(specialties)
    .where(eq(specialties.slug, slug))
    .limit(1);
  return row?.milestones ?? null;
}

/**
 * Resolves which backend is actually serving a specialty's data. In `postgres`
 * mode everything goes through Neon; in legacy mode the upstream source (xlsx
 * vs sheets) doubles as the runtime backend.
 */
export function getBackend(specialty: { source: 'sheets' | 'xlsx' }): Backend {
  const { mode } = getRepositories();
  if (mode === 'postgres') return 'postgres';
  return specialty.source;
}
