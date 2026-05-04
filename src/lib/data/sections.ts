import { connection } from 'next/server';
import { fetchQueryAsUser } from '@/lib/convex/server';
import type { ConsolidatedSection } from '@/lib/types';
import { api } from '../../../convex/_generated/api';

export async function listConsolidatedSections(
  slug: string,
): Promise<ConsolidatedSection[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.sections.listConsolidated, { slug });
  return rows.map(
    ({ _id: _i, _creationTime: _ct, specialtySlug: _s, ...rest }) =>
      rest as ConsolidatedSection,
  );
}
