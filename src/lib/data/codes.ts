import { fetchQuery } from 'convex/nextjs';
import { and, desc, eq, sql } from 'drizzle-orm';
import { connection } from 'next/server';
import { hydrateCodes } from '@/lib/convex-blobs';
import { getDb } from '@/lib/db';
import { pipelineRuns, pipelineStages } from '@/lib/db/schema';
import { api } from '../../../convex/_generated/api';

// Codes themselves live in Convex now (see `convex/codes.ts`). The pipeline
// dashboard still needs a couple of derived numbers — the unmapped-count
// badge, the category dropdown, and the unmapped-code autocomplete — and
// those reuse the Convex queries via SSR `fetchQuery`.
//
// `getConsolidationLockState` stays Postgres-served because pipeline state
// lives in `pipeline_stages` (Vercel Workflow durability) — the consolidation
// lock is derived from the most recent `consolidate_primary` stage row.

/**
 * How many codes for this specialty haven't been mapped yet (`isInAMBOSS`
 * unset). Drives the "N unmapped codes" label on the mapping CTA.
 */
export async function listUnmappedCodeCount(slug: string): Promise<number> {
  await connection();
  const rows = await fetchQuery(api.codes.listUnmapped, { slug });
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
  const rows = await fetchQuery(api.codes.listUnmapped, { slug });
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
 * is awaiting approval, succeeded, or failed without being reset. Absent row
 * or `pending`/`skipped` → unlocked.
 */
export async function getConsolidationLockState(
  slug: string,
): Promise<{ locked: boolean; status: string | null }> {
  const db = getDb();
  const [row] = await db
    .select({ status: pipelineStages.status })
    .from(pipelineStages)
    .innerJoin(pipelineRuns, eq(pipelineStages.runId, pipelineRuns.id))
    .where(
      and(
        eq(pipelineRuns.specialtySlug, slug),
        eq(pipelineStages.stage, 'consolidate_primary'),
      ),
    )
    .orderBy(
      desc(
        sql`COALESCE(${pipelineStages.finishedAt}, ${pipelineStages.startedAt}, ${pipelineRuns.startedAt})`,
      ),
    )
    .limit(1);
  const status = row?.status ?? null;
  const locked = status !== null && status !== 'pending' && status !== 'skipped';
  return { locked, status };
}

export type CodeCategorySummary = {
  category: string;
  total: number;
  unmapped: number;
};

/**
 * Per-category code counts for a specialty — used by the Start-mapping form
 * to populate the multi-select dropdown and compute live totals as the user
 * narrows the filter. Uncategorized rows surface under the synthetic
 * `"(uncategorized)"` label so they remain selectable.
 */
export async function listCodeCategories(slug: string): Promise<CodeCategorySummary[]> {
  await connection();
  // Fetched from Convex (the `codes` table is reactive there) and aggregated
  // in JS rather than via SQL. For our row counts (low thousands) this is
  // cheap; if the table grows by an order of magnitude we'd switch to a
  // maintained-counter pattern instead.
  const rows = hydrateCodes(await fetchQuery(api.codes.list, { slug }));
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
