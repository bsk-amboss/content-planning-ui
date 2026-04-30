import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

// Pipeline state. Workflow code (`'use step'` blocks under
// src/lib/workflows/) calls these mutations to persist run/stage progression
// and structured event logs. UI reads via the queries.
//
// Convex has no FK cascades — the resetStageCascade and run-deletion paths
// implement cascade-delete logic explicitly.

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

// ---------- Queries ---------------------------------------------------------

export const getCurrentRun = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const rows = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_specialty_started', (q) => q.eq('specialtySlug', slug))
      .order('desc')
      .collect();
    if (rows.length === 0) return null;
    const nonTerminal = rows.find((r) => !TERMINAL_STATUSES.has(r.status));
    return nonTerminal ?? rows[0];
  },
});

export const listRuns = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    await ctx.db
      .query('pipelineRuns')
      .withIndex('by_specialty_started', (q) => q.eq('specialtySlug', slug))
      .order('desc')
      .collect(),
});

export const getRun = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const id = ctx.db.normalizeId('pipelineRuns', runId);
    if (!id) return null;
    return await ctx.db.get(id);
  },
});

export const listStages = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    await ctx.db
      .query('pipelineStages')
      .withIndex('by_run', (q) => q.eq('runId', runId))
      .collect(),
});

export const listEvents = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const rows = await ctx.db
      .query('pipelineEvents')
      .withIndex('by_run', (q) => q.eq('runId', runId))
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const getStage = query({
  args: { runId: v.string(), stage: v.string() },
  handler: async (ctx, { runId, stage }) =>
    await ctx.db
      .query('pipelineStages')
      .withIndex('by_run_stage', (q) => q.eq('runId', runId).eq('stage', stage))
      .unique(),
});

/**
 * Latest stage per stage-name for a specialty, with each stage's owning run
 * URLs and the run+stage events. Used by the dashboard so each stage card is
 * self-contained.
 */
export const getLatestStageContexts = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const runs = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    if (runs.length === 0)
      return {} as Record<
        string,
        {
          stage: Doc<'pipelineStages'>;
          runUrls: string | null;
          events: Doc<'pipelineEvents'>[];
        }
      >;
    const runById = new Map<string, Doc<'pipelineRuns'>>(runs.map((r) => [r._id, r]));

    const stageRows: Doc<'pipelineStages'>[] = [];
    for (const r of runs) {
      const stages = await ctx.db
        .query('pipelineStages')
        .withIndex('by_run', (q) => q.eq('runId', r._id))
        .collect();
      for (const s of stages) stageRows.push(s);
    }

    // Pick the most recent stage per stage-name. Precedence:
    //   finishedAt > startedAt > run.startedAt.
    const latestByStage = new Map<string, { row: Doc<'pipelineStages'>; ts: number }>();
    for (const s of stageRows) {
      const run = runById.get(s.runId);
      const ts = s.finishedAt ?? s.startedAt ?? run?.startedAt ?? 0;
      const prev = latestByStage.get(s.stage);
      if (!prev || ts > prev.ts) latestByStage.set(s.stage, { row: s, ts });
    }

    const contributedRunIds = new Set(
      [...latestByStage.values()].map((v) => v.row.runId),
    );
    const eventRows: Doc<'pipelineEvents'>[] = [];
    for (const rid of contributedRunIds) {
      const evs = await ctx.db
        .query('pipelineEvents')
        .withIndex('by_run', (q) => q.eq('runId', rid))
        .collect();
      for (const e of evs) eventRows.push(e);
    }
    eventRows.sort((a, b) => a.createdAt - b.createdAt);

    const out: Record<
      string,
      {
        stage: Doc<'pipelineStages'>;
        runUrls: string | null;
        events: Doc<'pipelineEvents'>[];
      }
    > = {};
    for (const [stageName, { row }] of latestByStage.entries()) {
      const run = runById.get(row.runId);
      out[stageName] = {
        stage: row,
        runUrls: run?.contentOutlineUrls ?? null,
        events: eventRows.filter((e) => e.runId === row.runId && e.stage === stageName),
      };
    }
    return out;
  },
});

export const getMapCodesHistory = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const runs = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_specialty_started', (q) => q.eq('specialtySlug', slug))
      .order('desc')
      .collect();
    if (runs.length === 0)
      return { runs: [] as Doc<'pipelineRuns'>[], events: [] as Doc<'pipelineEvents'>[] };
    const events: Doc<'pipelineEvents'>[] = [];
    const runIdsWithMapEvents = new Set<string>();
    for (const r of runs) {
      const evs = await ctx.db
        .query('pipelineEvents')
        .withIndex('by_run_stage_created', (q) =>
          q.eq('runId', r._id).eq('stage', 'map_codes'),
        )
        .collect();
      if (evs.length > 0) {
        runIdsWithMapEvents.add(r._id);
        for (const e of evs) events.push(e);
      }
    }
    return {
      runs: runs.filter((r) => runIdsWithMapEvents.has(r._id)),
      events: events.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

/**
 * One-pass query: most recent run.status per specialty, for the home grid.
 */
export const listSpecialtyPhases = query({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db.query('pipelineRuns').collect();
    const latest = new Map<string, { status: string; startedAt: number }>();
    for (const r of runs) {
      const prev = latest.get(r.specialtySlug);
      if (!prev || r.startedAt > prev.startedAt) {
        latest.set(r.specialtySlug, { status: r.status, startedAt: r.startedAt });
      }
    }
    const out: Record<string, string> = {};
    for (const [slug, v] of latest.entries()) out[slug] = v.status;
    return out;
  },
});

export const listExtractedCodesForRun = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    await ctx.db
      .query('extractedCodes')
      .withIndex('by_run', (q) => q.eq('runId', runId))
      .collect(),
});

/**
 * Per-code mapping run metadata: the most recent `map_codes` run that touched
 * `code` for `slug`, plus the per-attempt event log for that code. Filters
 * events in-memory by parsing each metrics blob (Convex jsonb-equivalents are
 * stringified — no JSON-path operator).
 */
export const getCodeRunMetadata = query({
  args: { slug: v.string(), code: v.string() },
  handler: async (ctx, { slug, code }) => {
    const runs = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_specialty_started', (q) => q.eq('specialtySlug', slug))
      .order('desc')
      .collect();
    for (const run of runs) {
      const events = await ctx.db
        .query('pipelineEvents')
        .withIndex('by_run_stage_created', (q) =>
          q.eq('runId', run._id).eq('stage', 'map_codes'),
        )
        .collect();
      const codeEvents = events.filter((e) => {
        if (!e.metrics) return false;
        try {
          const m = JSON.parse(e.metrics) as { code?: string };
          return m.code === code;
        } catch {
          return false;
        }
      });
      if (codeEvents.length === 0) continue;
      const stageRow = await ctx.db
        .query('pipelineStages')
        .withIndex('by_run_stage', (q) => q.eq('runId', run._id).eq('stage', 'map_codes'))
        .unique();
      return {
        run,
        stage: stageRow,
        events: codeEvents.sort((a, b) => a.createdAt - b.createdAt),
      };
    }
    return null;
  },
});

/**
 * Consolidation lock state for a specialty. Locked when the most recent
 * `consolidate_primary` stage across every run for the specialty is in any
 * status other than `pending`/`skipped` (i.e. the run has started, is
 * awaiting approval, completed, or failed without being reset).
 */
export const getConsolidationLockState = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const runs = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    let latest: { status: string; ts: number } | null = null;
    for (const r of runs) {
      const stages = await ctx.db
        .query('pipelineStages')
        .withIndex('by_run_stage', (q) =>
          q.eq('runId', r._id).eq('stage', 'consolidate_primary'),
        )
        .collect();
      for (const s of stages) {
        const ts = s.finishedAt ?? s.startedAt ?? r.startedAt;
        if (!latest || ts > latest.ts) latest = { status: s.status, ts };
      }
    }
    const status = latest?.status ?? null;
    const locked = status !== null && status !== 'pending' && status !== 'skipped';
    return { locked, status };
  },
});

// ---------- Mutations -------------------------------------------------------

export const createRun = mutation({
  args: { specialtySlug: v.string(), workflowRunId: v.optional(v.string()) },
  handler: async (ctx, { specialtySlug, workflowRunId }) => {
    const now = Date.now();
    const id = await ctx.db.insert('pipelineRuns', {
      specialtySlug,
      status: 'running',
      workflowRunId,
      startedAt: now,
      updatedAt: now,
      mappingCheckIds: true,
    });
    return { id: id as string };
  },
});

export const updateRun = mutation({
  args: {
    runId: v.string(),
    patch: v.object({
      status: v.optional(v.string()),
      workflowRunId: v.optional(v.string()),
      finishedAt: v.optional(v.number()),
      error: v.optional(v.union(v.string(), v.null())),
      contentOutlineUrls: v.optional(v.string()),
      identifyModulesInstructions: v.optional(v.string()),
      extractCodesInstructions: v.optional(v.string()),
      milestonesInstructions: v.optional(v.union(v.string(), v.null())),
      mappingInstructions: v.optional(v.union(v.string(), v.null())),
      mappingCheckIds: v.optional(v.boolean()),
      mappingFilter: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { runId, patch }) => {
    const id = ctx.db.normalizeId('pipelineRuns', runId);
    if (!id) throw new Error(`run not found: ${runId}`);
    const cleaned: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) cleaned[k] = v;
    }
    await ctx.db.patch(id, cleaned);
  },
});

export const initStage = mutation({
  args: { runId: v.string(), stage: v.string() },
  handler: async (ctx, { runId, stage }) => {
    const id = await ctx.db.insert('pipelineStages', {
      runId,
      stage,
      status: 'pending',
    });
    return { id: id as string };
  },
});

export const updateStage = mutation({
  args: {
    runId: v.string(),
    stage: v.string(),
    patch: v.object({
      status: v.optional(v.string()),
      workflowRunId: v.optional(v.string()),
      startedAt: v.optional(v.union(v.number(), v.null())),
      finishedAt: v.optional(v.union(v.number(), v.null())),
      approvedAt: v.optional(v.union(v.number(), v.null())),
      approvedBy: v.optional(v.union(v.string(), v.null())),
      outputSummary: v.optional(v.union(v.string(), v.null())),
      draftPayload: v.optional(v.union(v.string(), v.null())),
      errorMessage: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, { runId, stage, patch }) => {
    const row = await ctx.db
      .query('pipelineStages')
      .withIndex('by_run_stage', (q) => q.eq('runId', runId).eq('stage', stage))
      .unique();
    if (!row) throw new Error(`stage not found: ${runId}/${stage}`);
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) cleaned[k] = v ?? undefined;
    }
    await ctx.db.patch(row._id, cleaned);
  },
});

export const logEvent = mutation({
  args: {
    runId: v.string(),
    stage: v.string(),
    level: v.string(),
    message: v.string(),
    metrics: v.optional(v.string()),
  },
  handler: async (ctx, { runId, stage, level, message, metrics }) => {
    await ctx.db.insert('pipelineEvents', {
      runId,
      stage,
      level,
      message,
      metrics,
      createdAt: Date.now(),
    });
  },
});

const extractedCodeRow = v.object({
  code: v.string(),
  category: v.optional(v.string()),
  consolidationCategory: v.optional(v.string()),
  description: v.optional(v.string()),
  source: v.optional(v.string()),
  metadata: v.optional(v.string()),
});

export const writeExtractedCodes = mutation({
  args: {
    runId: v.string(),
    specialtySlug: v.string(),
    rows: v.array(extractedCodeRow),
  },
  handler: async (ctx, { runId, specialtySlug, rows }) => {
    const now = Date.now();
    for (const r of rows) {
      await ctx.db.insert('extractedCodes', {
        runId,
        specialtySlug,
        ...r,
        createdAt: now,
      });
    }
  },
});

/**
 * Cancel every non-terminal run for a specialty. Returns count cancelled.
 */
export const cancelStaleRunsForSpecialty = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const rows = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    const now = Date.now();
    let cancelled = 0;
    for (const r of rows) {
      if (TERMINAL_STATUSES.has(r.status)) continue;
      await ctx.db.patch(r._id, {
        status: 'cancelled',
        finishedAt: now,
        updatedAt: now,
      });
      cancelled += 1;
    }
    return { cancelled };
  },
});

/**
 * Wipe the events + extracted_codes scoped to (runId, stage) and reset the
 * stage row to pending. The mutations on the editor data tables (codes /
 * articles / sections / specialties.milestones) are still invoked from the
 * caller's reset path — they're per-table and can run in parallel.
 */
export const resetStage = mutation({
  args: { runId: v.string(), stage: v.string() },
  handler: async (ctx, { runId, stage }) => {
    const events = await ctx.db
      .query('pipelineEvents')
      .withIndex('by_run_stage_created', (q) => q.eq('runId', runId).eq('stage', stage))
      .collect();
    for (const e of events) await ctx.db.delete(e._id);

    if (stage === 'extract_codes') {
      const ec = await ctx.db
        .query('extractedCodes')
        .withIndex('by_run', (q) => q.eq('runId', runId))
        .collect();
      for (const r of ec) await ctx.db.delete(r._id);
    }

    const stageRow = await ctx.db
      .query('pipelineStages')
      .withIndex('by_run_stage', (q) => q.eq('runId', runId).eq('stage', stage))
      .unique();
    if (stageRow) {
      await ctx.db.patch(stageRow._id, {
        status: 'pending',
        startedAt: undefined,
        finishedAt: undefined,
        approvedAt: undefined,
        approvedBy: undefined,
        outputSummary: undefined,
        draftPayload: undefined,
        errorMessage: undefined,
      });
    }
  },
});
