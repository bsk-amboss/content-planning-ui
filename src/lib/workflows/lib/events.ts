/**
 * Per-stage event logger — writes a row to pipelineEvents in Convex for
 * observability. Called from inside other `'use step'` functions; making
 * `logEvent` itself a step gives it its own retry semantics and bakes the
 * event-log writes into the workflow's durability replay.
 */

import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '../../../../convex/_generated/api';
import type { StageName } from './db-writes';

function workflowSecret(): string {
  const s = process.env.WORKFLOW_SECRET;
  if (!s) {
    throw new Error('WORKFLOW_SECRET unset — workflow cannot authenticate to Convex.');
  }
  return s;
}

export type EventLevel = 'info' | 'warn' | 'error';

export type EventMetrics = {
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number | null;
  model?: string;
  /** Which provider produced the call. Used by the UI to badge attempts and
   *  by aggregateStageMetrics to tell escalations apart from primary calls. */
  provider?: 'google' | 'anthropic' | 'openai';
  /** Reasoning level passed to the model — surfaces what the user picked at
   *  kickoff so the per-call browser can show e.g. "Gemini 3 Flash · low". */
  reasoning?: 'auto' | 'low' | 'medium' | 'high';
  url?: string;
  source?: string;
  category?: string;
  /** Which sub-step produced the event — so the UI can split completions
   *  into "Identify modules" / "Extract codes" / "Milestones" / "Map" buckets. */
  phase?: 'identify' | 'extract' | 'milestones' | 'map';
  /** Raw parsed LLM output for this call. */
  completion?: unknown;
  /** Per-code metadata for `map` events. */
  code?: string;
  attempts?: number;
  invalidIds?: string[];
  mcpToolCalls?: number;
  mcpToolNames?: string[];
};

export async function logEvent(input: {
  runId: string;
  stage: StageName;
  level: EventLevel;
  message: string;
  metrics?: EventMetrics;
}): Promise<void> {
  'use step';
  await fetchMutation(api.pipeline.logEvent, {
    runId: input.runId,
    stage: input.stage,
    level: input.level,
    message: input.message,
    metrics: input.metrics ? JSON.stringify(input.metrics) : undefined,
    _secret: workflowSecret(),
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
 * Sum per-call metrics from pipelineEvents for a single stage, plus wall-clock
 * durationMs from the stage's startedAt. Called once at stage completion to
 * populate outputSummary.
 */
export async function aggregateStageMetrics(
  runId: string,
  stage: StageName,
): Promise<StageTotals> {
  'use step';
  const events = await fetchQuery(api.pipeline.listEvents, {
    runId,
    _secret: workflowSecret(),
  });
  const stageRow = await fetchQuery(api.pipeline.getStage, {
    runId,
    stage,
    _secret: workflowSecret(),
  });

  let apiCalls = 0;
  let computeMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let costUsd = 0;
  let anyCost = false;
  for (const e of events) {
    if (e.stage !== stage) continue;
    const m = (e.metrics ? JSON.parse(e.metrics) : {}) as EventMetrics;
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

  const durationMs = stageRow?.startedAt
    ? Math.max(0, Date.now() - stageRow.startedAt)
    : null;

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
