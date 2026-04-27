/**
 * Cached readers for pipeline runs + stages.
 *
 * All reads are cached under `pipeline:<slug>` so a single `revalidateTag`
 * invalidates everything for a specialty. `cacheLife('seconds')` keeps the
 * dashboard within a few seconds of DB truth without saturating the DB.
 */

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { pipelineEvents, pipelineRuns, pipelineStages } from '@/lib/db/schema';
import { derivePhase, type Phase } from '@/lib/phase';
import type { StageName } from '@/lib/workflows/lib/db-writes';

export type PipelineRunRow = typeof pipelineRuns.$inferSelect;
export type PipelineStageRow = typeof pipelineStages.$inferSelect;
export type PipelineEventRow = typeof pipelineEvents.$inferSelect;

/**
 * A stage row with the context needed to render it — the inputs that produced
 * it (from the stage's own run) and the event log filtered to just that run +
 * stage. Used by the dashboard so each stage card is self-contained and not
 * coupled to a single "current run."
 */
export type StageContext = {
  stage: PipelineStageRow;
  runUrls: unknown;
  events: PipelineEventRow[];
};

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
 * Return one `StageContext` per stage name for a specialty — picking the most
 * recent stage row across every run. This lets the dashboard show the true
 * state of (e.g.) `extract_codes` even when the latest run was a milestones
 * run that contains only `extract_milestones`.
 *
 * "Most recent" uses `finished_at` first (terminal stages), then `started_at`
 * (mid-run), then the run's `started_at` (pending stages), to cover every
 * lifecycle phase.
 */
export async function getLatestStageContexts(
  slug: string,
): Promise<Partial<Record<StageName, StageContext>>> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
  const db = getDb();

  // DISTINCT ON (stage) keeps one row per stage name — whichever has the most
  // recent activity. Join to pipeline_runs so we can pull contentOutlineUrls
  // for each stage's originating run in a single pass.
  const result = await db.execute<{
    stage: string;
    run_id: string;
    id: string;
    status: string;
    workflow_run_id: string | null;
    started_at: Date | null;
    finished_at: Date | null;
    approved_at: Date | null;
    approved_by: string | null;
    output_summary: unknown;
    draft_payload: unknown;
    error_message: string | null;
    content_outline_urls: unknown;
  }>(sql`
    SELECT DISTINCT ON (ps.stage)
      ps.stage,
      ps.run_id,
      ps.id,
      ps.status,
      ps.workflow_run_id,
      ps.started_at,
      ps.finished_at,
      ps.approved_at,
      ps.approved_by,
      ps.output_summary,
      ps.draft_payload,
      ps.error_message,
      pr.content_outline_urls
    FROM pipeline_stages ps
    JOIN pipeline_runs pr ON ps.run_id = pr.id
    WHERE pr.specialty_slug = ${slug}
    ORDER BY
      ps.stage,
      COALESCE(ps.finished_at, ps.started_at, pr.started_at) DESC
  `);
  const rows =
    (result as unknown as { rows?: typeof result }).rows ??
    (result as unknown as typeof result);

  const stageRows = (rows as unknown as Array<Record<string, unknown>>) ?? [];
  if (stageRows.length === 0) return {};

  // Fetch events for every run that contributed a latest stage, then partition
  // by (runId, stageName) so each card only sees its own log.
  const runIds = [...new Set(stageRows.map((r) => String(r.run_id)))];
  const eventRows = await db
    .select()
    .from(pipelineEvents)
    .where(inArray(pipelineEvents.runId, runIds))
    .orderBy(asc(pipelineEvents.createdAt));

  const out: Partial<Record<StageName, StageContext>> = {};
  for (const r of stageRows) {
    const stageName = r.stage as StageName;
    const runId = String(r.run_id);
    const events = eventRows.filter((e) => e.runId === runId && e.stage === stageName);
    const stage: PipelineStageRow = {
      id: String(r.id),
      runId,
      stage: stageName,
      status: String(r.status),
      workflowRunId: (r.workflow_run_id as string | null) ?? null,
      startedAt: (r.started_at as Date | null) ?? null,
      finishedAt: (r.finished_at as Date | null) ?? null,
      approvedAt: (r.approved_at as Date | null) ?? null,
      approvedBy: (r.approved_by as string | null) ?? null,
      outputSummary: r.output_summary ?? null,
      draftPayload: r.draft_payload ?? null,
      errorMessage: (r.error_message as string | null) ?? null,
    };
    out[stageName] = {
      stage,
      runUrls: r.content_outline_urls ?? null,
      events,
    };
  }
  return out;
}

/**
 * History of every map_codes activity for a specialty: each pipeline run that
 * touched map_codes (extracted from the events table, since per-code remap-code
 * runs each get their own pipeline_runs row), plus all map_codes events for
 * those runs. Used by the Map codes stage card to render Overall + per-run
 * navigation of metadata and logs.
 *
 * Returned `runs` are sorted newest-first.
 */
export type MapCodesHistory = {
  runs: PipelineRunRow[];
  events: PipelineEventRow[];
};

export async function getMapCodesHistory(slug: string): Promise<MapCodesHistory> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
  const db = getDb();
  // Pull every map_codes event for the specialty in one shot (joining to runs
  // so we filter by specialty without round-tripping through pipeline_runs).
  const eventRows = await db
    .select({
      id: pipelineEvents.id,
      runId: pipelineEvents.runId,
      stage: pipelineEvents.stage,
      level: pipelineEvents.level,
      message: pipelineEvents.message,
      metrics: pipelineEvents.metrics,
      createdAt: pipelineEvents.createdAt,
    })
    .from(pipelineEvents)
    .innerJoin(pipelineRuns, eq(pipelineEvents.runId, pipelineRuns.id))
    .where(
      and(eq(pipelineRuns.specialtySlug, slug), eq(pipelineEvents.stage, 'map_codes')),
    )
    .orderBy(asc(pipelineEvents.createdAt));
  if (eventRows.length === 0) return { runs: [], events: [] };
  const runIds = [...new Set(eventRows.map((e) => e.runId))];
  const runs = await db
    .select()
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.specialtySlug, slug), inArray(pipelineRuns.id, runIds)))
    .orderBy(desc(pipelineRuns.startedAt));
  return { runs, events: eventRows as PipelineEventRow[] };
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
