/**
 * Cached readers for pipeline runs + stages.
 *
 * All reads are cached under `pipeline:<slug>` so a single `revalidateTag`
 * invalidates everything for a specialty. `cacheLife('seconds')` keeps the
 * dashboard within a few seconds of DB truth without saturating the DB.
 */

import { asc, desc, eq, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { pipelineEvents, pipelineRuns, pipelineStages } from '@/lib/db/schema';
import { derivePhase, type Phase } from '@/lib/phase';

export type PipelineRunRow = typeof pipelineRuns.$inferSelect;
export type PipelineStageRow = typeof pipelineStages.$inferSelect;
export type PipelineEventRow = typeof pipelineEvents.$inferSelect;

/**
 * The "current" run for a specialty: the most recent non-terminal run if one
 * exists; otherwise the most recent run of any status (so the UI can still
 * show the last completed/failed state). Null if the specialty has no runs.
 */
export async function getCurrentPipelineRun(
  slug: string,
): Promise<PipelineRunRow | null> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
  const db = getDb();
  const rows = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.specialtySlug, slug))
    .orderBy(desc(pipelineRuns.startedAt));
  if (rows.length === 0) return null;
  const nonTerminal = rows.find(
    (r) => r.status !== 'completed' && r.status !== 'failed' && r.status !== 'cancelled',
  );
  return nonTerminal ?? rows[0];
}

export async function listPipelineRuns(slug: string): Promise<PipelineRunRow[]> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
  const db = getDb();
  return db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.specialtySlug, slug))
    .orderBy(desc(pipelineRuns.startedAt));
}

export async function listPipelineStages(
  runId: string,
  slug: string,
): Promise<PipelineStageRow[]> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
  const db = getDb();
  return db.select().from(pipelineStages).where(eq(pipelineStages.runId, runId));
}

export async function listPipelineEvents(
  runId: string,
  slug: string,
): Promise<PipelineEventRow[]> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
  const db = getDb();
  return db
    .select()
    .from(pipelineEvents)
    .where(eq(pipelineEvents.runId, runId))
    .orderBy(asc(pipelineEvents.createdAt));
}

/**
 * Phase lookup for the home-page specialty grid. One query returns the most
 * recent run status per specialty; result is keyed by slug. Specialties with
 * no runs are absent from the map (callers treat that as `not_started`).
 */
export async function listSpecialtyPhases(): Promise<Record<string, Phase>> {
  'use cache';
  cacheTag('specialty-phases');
  cacheLife('seconds');
  const db = getDb();
  const result = await db.execute<{ specialty_slug: string; status: string }>(
    sql.raw(
      'SELECT DISTINCT ON (specialty_slug) specialty_slug, status FROM pipeline_runs ORDER BY specialty_slug, started_at DESC',
    ),
  );
  const rows =
    (result as unknown as { rows: Array<{ specialty_slug: string; status: string }> })
      .rows ?? (result as unknown as Array<{ specialty_slug: string; status: string }>);
  const out: Record<string, Phase> = {};
  for (const r of rows ?? []) {
    out[r.specialty_slug] = derivePhase({ status: r.status });
  }
  return out;
}
