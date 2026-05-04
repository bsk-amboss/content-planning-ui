import { connection } from 'next/server';
import { fetchQueryAsUser } from '@/lib/convex/server';
import { api } from '../../../convex/_generated/api';

/**
 * How many codes for this specialty haven't been mapped yet (`isInAMBOSS`
 * unset). Drives the "N unmapped codes" label on the mapping CTA.
 */
export async function listUnmappedCodeCount(slug: string): Promise<number> {
  await connection();
  const rows = await fetchQueryAsUser(api.codes.listUnmapped, { slug });
  return rows.length;
}

export type UnmappedCodePickerRow = {
  code: string;
  description: string | null;
  category: string | null;
};

/**
 * Every unmapped code for a specialty with enough metadata to populate an
 * autocomplete. The map-codes form uses this to let the user pin a run to a
 * specific code by searching by code ID or description.
 */
export async function listUnmappedCodesForPicker(
  slug: string,
): Promise<UnmappedCodePickerRow[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.codes.listUnmapped, { slug });
  return rows
    .map((r) => ({ code: r.code, description: r.description, category: r.category }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Is consolidation "active" for this specialty? Gates inline edits and the
 * remap-already-mapped action in the codes table.
 *
 * Locked when the most recent `consolidate_primary` stage for this specialty
 * is in any state other than `pending`/`skipped` — i.e. the run has started,
 * is awaiting approval, succeeded, or failed without being reset.
 */
export async function getConsolidationLockState(
  slug: string,
): Promise<{ locked: boolean; status: string | null }> {
  await connection();
  return await fetchQueryAsUser(api.pipeline.getConsolidationLockState, { slug });
}

export type CodeCategorySummary = {
  category: string;
  total: number;
  unmapped: number;
};

/**
 * Per-category code counts for a specialty — used by the Start-mapping form
 * to populate the multi-select dropdown and compute live totals as the user
 * narrows the filter.
 */
export async function listCodeCategories(slug: string): Promise<CodeCategorySummary[]> {
  await connection();
  const rows = await fetchQueryAsUser(api.codes.list, { slug });
  const totals = new Map<string, { total: number; unmapped: number }>();
  for (const r of rows) {
    const cat = r.category ?? '(uncategorized)';
    const entry = totals.get(cat) ?? { total: 0, unmapped: 0 };
    entry.total += 1;
    if (r.isInAMBOSS === undefined) entry.unmapped += 1;
    totals.set(cat, entry);
  }
  return Array.from(totals.entries())
    .map(([category, t]) => ({ category, total: t.total, unmapped: t.unmapped }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
