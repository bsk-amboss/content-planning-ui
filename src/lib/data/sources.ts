import { fetchQuery } from 'convex/nextjs';
import { connection } from 'next/server';
import type { OntologySource } from '@/lib/repositories/common/tab-names';
import { api } from '../../../convex/_generated/api';

export async function listSourceOntology(slug: string, source: OntologySource) {
  await connection();
  switch (source) {
    case 'ICD10':
      return {
        source,
        rows: await fetchQuery(api.ontology.listIcd10, { slug }),
      } as const;
    case 'HCUP':
      return { source, rows: await fetchQuery(api.ontology.listHcup, { slug }) } as const;
    case 'ABIM':
      return { source, rows: await fetchQuery(api.ontology.listAbim, { slug }) } as const;
    case 'Orpha':
      return {
        source,
        rows: await fetchQuery(api.ontology.listOrpha, { slug }),
      } as const;
  }
}
