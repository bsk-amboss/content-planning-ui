import { connection } from 'next/server';
import { fetchQueryAsUser } from '@/lib/convex/server';
import type { CodeCategory } from '@/lib/types';
import { api } from '../../../convex/_generated/api';

// Categories live in Convex now (mirrors specialties.ts pattern). Live updates
// are available to client components via `useQuery(api.categories.list)`; the
// existing SSR pages keep using this snapshot helper.
export async function listCategories(slug: string): Promise<CodeCategory[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.categories.list, { slug });
  // Strip Convex's `_id` / `_creationTime` so the type matches the legacy
  // CodeCategory shape consumers expect. JSON-string blob fields aren't on
  // this table — codeCategories only stores arrays of plain strings.
  return rows.map(
    ({ _id: _i, _creationTime: _ct, specialtySlug: _s, ...rest }) => rest as CodeCategory,
  );
}
