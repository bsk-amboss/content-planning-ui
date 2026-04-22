import { cacheLife, cacheTag } from 'next/cache';
import { getRepositories } from '@/lib/repositories';

export async function listCodes(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `codes:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.codes.list(slug);
}
