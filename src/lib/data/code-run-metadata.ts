/**
 * Per-code mapping run metadata loader.
 *
 * Reads `pipeline_events` for the most recent `map_codes` run that touched a
 * specific code, returning per-attempt usage + aggregate totals. Powers the
 * Metadata tab in the code-detail modal.
 *
 * Definition of "most recent": grouped by run id, pick the latest run that has
 * any phase=map event for this code. We can't simply order by event timestamp
 * because a run interleaves attempts with the rest of its specialty's batch —
 * grouping keeps each run's attempts together.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pipelineEvents, pipelineRuns, pipelineStages } from '@/lib/db/schema';
import type { EventMetrics } from '@/lib/workflows/lib/events';

export type CodeRunAttempt = {
  createdAt: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  model: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
  mcpToolCalls: number | null;
  mcpToolNames: string[] | null;
  attempts: number | null;
  invalidIds: string[] | null;
};

export type CodeRunMetadata = {
  runId: string;
  runStartedAt: string;
  runFinishedAt: string | null;
  stageStatus: string | null;
  finalModel: string | null;
  totals: {
    costUsd: number | null;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    durationMs: number;
    mcpToolCalls: number;
  };
  toolBreakdown: Array<{ name: string; count: number }>;
  attempts: CodeRunAttempt[];
};

export async function loadCodeMappingMetadata(
  slug: string,
  code: string,
): Promise<CodeRunMetadata | null> {
  const db = getDb();

  // Find the latest run for this specialty that has a phase=map event for the
  // given code. The `metrics->>'code'` JSON path is indexed only on
  // (run_id, stage, created_at) — fine because we filter by stage first.
  const [latest] = await db
    .select({
      runId: pipelineEvents.runId,
      runStartedAt: pipelineRuns.startedAt,
      runFinishedAt: pipelineRuns.finishedAt,
    })
    .from(pipelineEvents)
    .innerJoin(pipelineRuns, eq(pipelineEvents.runId, pipelineRuns.id))
    .where(
      and(
        eq(pipelineRuns.specialtySlug, slug),
        eq(pipelineEvents.stage, 'map_codes'),
        sql`${pipelineEvents.metrics}->>'code' = ${code}`,
      ),
    )
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(1);

  if (!latest) return null;

  const [stageRow] = await db
    .select({ status: pipelineStages.status })
    .from(pipelineStages)
    .where(
      and(eq(pipelineStages.runId, latest.runId), eq(pipelineStages.stage, 'map_codes')),
    )
    .limit(1);

  const events = await db
    .select({
      createdAt: pipelineEvents.createdAt,
      level: pipelineEvents.level,
      message: pipelineEvents.message,
      metrics: pipelineEvents.metrics,
    })
    .from(pipelineEvents)
    .where(
      and(
        eq(pipelineEvents.runId, latest.runId),
        eq(pipelineEvents.stage, 'map_codes'),
        sql`${pipelineEvents.metrics}->>'code' = ${code}`,
      ),
    )
    .orderBy(asc(pipelineEvents.createdAt));

  const attempts: CodeRunAttempt[] = events.map((e) => {
    const m = (e.metrics ?? {}) as EventMetrics;
    return {
      createdAt: new Date(e.createdAt).toISOString(),
      level: (e.level as 'info' | 'warn' | 'error') ?? 'info',
      message: e.message,
      model: m.model ?? null,
      durationMs: typeof m.durationMs === 'number' ? m.durationMs : null,
      inputTokens: typeof m.inputTokens === 'number' ? m.inputTokens : null,
      outputTokens: typeof m.outputTokens === 'number' ? m.outputTokens : null,
      reasoningTokens: typeof m.reasoningTokens === 'number' ? m.reasoningTokens : null,
      costUsd: typeof m.costUsd === 'number' ? m.costUsd : null,
      mcpToolCalls: typeof m.mcpToolCalls === 'number' ? m.mcpToolCalls : null,
      mcpToolNames: Array.isArray(m.mcpToolNames) ? m.mcpToolNames : null,
      attempts: typeof m.attempts === 'number' ? m.attempts : null,
      invalidIds: Array.isArray(m.invalidIds) ? m.invalidIds : null,
    };
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let durationMs = 0;
  let mcpToolCalls = 0;
  let costUsd = 0;
  let anyCost = false;
  const toolCounts = new Map<string, number>();
  let finalModel: string | null = null;
  for (const a of attempts) {
    if (a.inputTokens) inputTokens += a.inputTokens;
    if (a.outputTokens) outputTokens += a.outputTokens;
    if (a.reasoningTokens) reasoningTokens += a.reasoningTokens;
    if (a.durationMs) durationMs += a.durationMs;
    if (a.mcpToolCalls) mcpToolCalls += a.mcpToolCalls;
    if (typeof a.costUsd === 'number') {
      costUsd += a.costUsd;
      anyCost = true;
    }
    if (a.mcpToolNames) {
      for (const name of a.mcpToolNames) {
        toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
      }
    }
    // finalModel: pick the model from the latest attempt that actually ran a
    // call (parse/validate failures still log model, so this works).
    if (a.model && a.model !== 'mapper-ladder') finalModel = a.model;
  }

  const toolBreakdown = [...toolCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((x, y) => y.count - x.count);

  return {
    runId: latest.runId,
    runStartedAt: new Date(latest.runStartedAt).toISOString(),
    runFinishedAt: latest.runFinishedAt
      ? new Date(latest.runFinishedAt).toISOString()
      : null,
    stageStatus: stageRow?.status ?? null,
    finalModel,
    totals: {
      costUsd: anyCost ? costUsd : null,
      inputTokens,
      outputTokens,
      reasoningTokens,
      durationMs,
      mcpToolCalls,
    },
    toolBreakdown,
    attempts,
  };
}
