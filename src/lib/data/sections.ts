import { cacheLife, cacheTag } from 'next/cache';
import { getRepositories } from '@/lib/repositories';

export async function listConsolidatedSections(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `sections:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.sections.listConsolidated(slug);
}
