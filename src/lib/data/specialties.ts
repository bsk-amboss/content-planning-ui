import { cacheLife, cacheTag } from 'next/cache';
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
 * Resolves which backend is actually serving a specialty's data. In `postgres`
 * mode everything goes through Neon; in legacy mode the upstream source (xlsx
 * vs sheets) doubles as the runtime backend.
 */
export function getBackend(specialty: { source: 'sheets' | 'xlsx' }): Backend {
  const { mode } = getRepositories();
  if (mode === 'postgres') return 'postgres';
  return specialty.source;
}
