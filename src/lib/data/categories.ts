import { cacheLife, cacheTag } from 'next/cache';
import { getRepositories } from '@/lib/repositories';

export async function listCategories(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `categories:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.categories.list(slug);
}
