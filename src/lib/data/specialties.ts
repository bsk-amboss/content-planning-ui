import { cacheLife, cacheTag } from 'next/cache';
import { getRepositories } from '@/lib/repositories';

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
