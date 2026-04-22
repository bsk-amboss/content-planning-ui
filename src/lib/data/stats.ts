import { cacheLife, cacheTag } from 'next/cache';
import { getRepositories } from '@/lib/repositories';

export async function getStats(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `stats:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.stats.get(slug);
}
