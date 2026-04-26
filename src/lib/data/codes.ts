import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { codes, pipelineRuns, pipelineStages } from '@/lib/db/schema';
import { getRepositories } from '@/lib/repositories';

export async function listCodes(slug: string) {
  'use cache';
  cacheTag(`specialty:${slug}`, `codes:${slug}`);
  cacheLife('minutes');
  const { repos } = getRepositories();
  return repos.codes.list(slug);
}

/**
 * Codes currently being mapped by an active `map_codes` run for this specialty.
 * Used by the codes table to flag in-flight rows with a "Mapping…" indicator
 * and to drive a poll-and-refresh cycle while work is outstanding.
 *
 * Definition: for every map_codes stage in `running` for this specialty, take
 * the run's `mappingFilter` (or all unmapped if null) and return the codes
 * that still have `isInAmboss IS NULL`. Finished codes drop out of the set on
 * the next read because their `isInAmboss` is no longer null, so the polling
 * UI naturally narrows the spinner row-by-row as the workflow progresses.
 *
 * Not cached — the whole point is to surface live progress.
 */
export async function listInFlightMappings(slug: string): Promise<string[]> {
  const db = getDb();
  const activeRuns = await db
    .select({
      runId: pipelineRuns.id,
      filter: pipelineRuns.mappingFilter,
    })
    .from(pipelineStages)
    .innerJoin(pipelineRuns, eq(pipelineStages.runId, pipelineRuns.id))
    .where(
      and(
        eq(pipelineRuns.specialtySlug, slug),
        eq(pipelineStages.stage, 'map_codes'),
        eq(pipelineStages.status, 'running'),
      ),
    );
  if (activeRuns.length === 0) return [];

  const out = new Set<string>();
  for (const run of activeRuns) {
    const filter = (run.filter ?? null) as {
      categories?: unknown;
      codes?: unknown;
    } | null;
    const cats = Array.isArray(filter?.categories)
      ? filter.categories.filter(
          (s): s is string => typeof s === 'string' && s.length > 0,
        )
      : [];
    const ids = Array.isArray(filter?.codes)
      ? filter.codes.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : [];
    const conditions = [eq(codes.specialtySlug, slug), isNull(codes.isInAmboss)];
    if (cats.length > 0 && ids.length > 0) {
      const clause = or(inArray(codes.category, cats), inArray(codes.code, ids));
      if (clause) conditions.push(clause);
    } else if (cats.length > 0) {
      conditions.push(inArray(codes.category, cats));
    } else if (ids.length > 0) {
      conditions.push(inArray(codes.code, ids));
    }
    const rows = await db
      .select({ code: codes.code })
      .from(codes)
      .where(and(...conditions));
    for (const r of rows) out.add(r.code);
  }
  return [...out];
}

/**
 * How many codes for this specialty haven't been mapped yet (`is_in_amboss
 * IS NULL`). Drives the "N unmapped codes" label on the mapping CTA.
 */
export async function listUnmappedCodeCount(slug: string): Promise<number> {
  'use cache';
  cacheTag(`codes:${slug}`);
  cacheLife('minutes');
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(codes)
    .where(and(eq(codes.specialtySlug, slug), isNull(codes.isInAmboss)));
  return row?.n ?? 0;
}

export type CodeCategorySummary = {
  category: string;
  total: number;
  unmapped: number;
};

export type UnmappedCodePickerRow = {
  code: string;
  description: string | null;
  category: string | null;
};

/**
 * Every unmapped code for a specialty with enough metadata to populate an
 * autocomplete. The map-codes form uses this to let the user pin a run to a
 * specific code by searching by code ID or description. Cached so repeat
 * page loads don't replay a large `SELECT`.
 */
export async function listUnmappedCodesForPicker(
  slug: string,
): Promise<UnmappedCodePickerRow[]> {
  'use cache';
  cacheTag(`codes:${slug}`);
  cacheLife('minutes');
  const db = getDb();
  const rows = await db
    .select({
      code: codes.code,
      description: codes.description,
      category: codes.category,
    })
    .from(codes)
    .where(and(eq(codes.specialtySlug, slug), isNull(codes.isInAmboss)))
    .orderBy(codes.code);
  return rows;
}

/**
 * Is consolidation "active" for this specialty? Gates inline edits and the
 * remap-already-mapped action in the codes table.
 *
 * Locked when the most recent `consolidate_primary` stage for this specialty
 * is in any state other than `pending`/`skipped` — i.e. the run has started,
 * is awaiting approval, succeeded, or failed without being reset. Absent row
 * or `pending`/`skipped` → unlocked.
 *
 * `resetStageCascade('consolidate_primary')` puts the stage back to `pending`
 * and clears downstream tables, which reopens the gate on the next read
 * because `pipeline:${slug}` is already revalidated by the reset endpoint.
 */
export async function getConsolidationLockState(
  slug: string,
): Promise<{ locked: boolean; status: string | null }> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
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

/**
 * Per-category code counts for a specialty — used by the Start-mapping form
 * to populate the multi-select dropdown and compute live totals as the user
 * narrows the filter. Uncategorized rows surface under the synthetic
 * `"(uncategorized)"` label so they remain selectable.
 */
export async function listCodeCategories(slug: string): Promise<CodeCategorySummary[]> {
  'use cache';
  cacheTag(`codes:${slug}`);
  cacheLife('minutes');
  const db = getDb();
  const rows = await db
    .select({
      category: sql<string>`COALESCE(${codes.category}, '(uncategorized)')`,
      total: sql<number>`count(*)::int`,
      unmapped: sql<number>`count(*) filter (where ${codes.isInAmboss} is null)::int`,
    })
    .from(codes)
    .where(eq(codes.specialtySlug, slug))
    .groupBy(sql`COALESCE(${codes.category}, '(uncategorized)')`)
    .orderBy(sql`COALESCE(${codes.category}, '(uncategorized)')`);
  return rows.map((r) => ({
    category: r.category,
    total: r.total,
    unmapped: r.unmapped,
  }));
}
