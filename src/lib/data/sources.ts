import { cacheLife, cacheTag } from 'next/cache';
import { getRepositories } from '@/lib/repositories';
import type { OntologySource } from '@/lib/repositories/common/tab-names';

export async function listSourceOntology(slug: string, source: OntologySource) {
  'use cache';
  cacheTag(`specialty:${slug}`, `sources:${slug}`, `sources:${slug}:${source}`);
  cacheLife('hours');
  const { repos } = getRepositories();
  switch (source) {
    case 'ICD10':
      return { source, rows: await repos.sources.icd10(slug) } as const;
    case 'HCUP':
      return { source, rows: await repos.sources.hcup(slug) } as const;
    case 'ABIM':
      return { source, rows: await repos.sources.abim(slug) } as const;
    case 'Orpha':
      return { source, rows: await repos.sources.orpha(slug) } as const;
  }
}
