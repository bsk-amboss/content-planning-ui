/**
 * Per-stage event logger — writes a row to pipeline_events for observability.
 *
 * Called from inside other `"use step"` functions (which have full Node/DB
 * access). Making logEvent itself a step gives it its own retry semantics and
 * keeps the event-log's truth table in the workflow event log, not side
 * effects.
 */

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pipelineEvents, pipelineStages } from '@/lib/db/schema';
import type { StageName } from './db-writes';

export type EventLevel = 'info' | 'warn' | 'error';

export type EventMetrics = {
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number | null;
  model?: string;
  url?: string;
  source?: string;
  category?: string;
  /** Which preprocessing sub-step produced the event — so the UI can split
   *  completions into "Identify modules" / "Extract codes" / "Milestones"
   *  buckets. */
  phase?: 'identify' | 'extract' | 'milestones';
  /** Raw parsed LLM output for this call. Array of `{ category }` for
   *  `identify` events; array of `{ category, description }` for `extract`
   *  events; a plain string for `milestones` events. Stored verbatim so the UI
   *  can render the actual completions. */
  completion?: unknown;
};

export async function logEvent(input: {
  runId: string;
  stage: StageName;
  level: EventLevel;
  message: string;
  metrics?: EventMetrics;
}): Promise<void> {
  'use step';
  const db = getDb();
  await db.insert(pipelineEvents).values({
    runId: input.runId,
    stage: input.stage,
    level: input.level,
    message: input.message,
    metrics: input.metrics ?? null,
  });
}

export type StageTotals = {
  apiCalls: number;
  durationMs: number | null;
  computeMs: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd: number | null;
};

/**
 * Sum per-call metrics from pipeline_events for a single stage, and compute
 * wall-clock durationMs from the pipeline_stages row's startedAt. Called once
 * at stage completion to populate outputSummary.
 */
export async function aggregateStageMetrics(
  runId: string,
  stage: StageName,
): Promise<StageTotals> {
  'use step';
  const db = getDb();
  const events = await db
    .select()
    .from(pipelineEvents)
    .where(and(eq(pipelineEvents.runId, runId), eq(pipelineEvents.stage, stage)));

  let apiCalls = 0;
  let computeMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let costUsd = 0;
  let anyCost = false;
  for (const e of events) {
    const m = (e.metrics ?? {}) as EventMetrics;
    if (typeof m.durationMs === 'number' && m.durationMs > 0) {
      apiCalls += 1;
      computeMs += m.durationMs;
    }
    if (typeof m.inputTokens === 'number') inputTokens += m.inputTokens;
    if (typeof m.outputTokens === 'number') outputTokens += m.outputTokens;
    if (typeof m.reasoningTokens === 'number') reasoningTokens += m.reasoningTokens;
    if (typeof m.costUsd === 'number') {
      costUsd += m.costUsd;
      anyCost = true;
    }
  }

  const [row] = await db
    .select({ startedAt: pipelineStages.startedAt })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.runId, runId), eq(pipelineStages.stage, stage)))
    .limit(1);
  const durationMs = row?.startedAt
    ? Math.max(0, Date.now() - new Date(row.startedAt).getTime())
    : null;

  void sql; // reserved for future raw aggregation if needed

  return {
    apiCalls,
    durationMs,
    computeMs,
    inputTokens,
    outputTokens,
    reasoningTokens,
    costUsd: anyCost ? costUsd : null,
  };
}
