/**
 * Readers for pipeline runs + stages. Convex-backed since Phase 3 of the
 * migration; the previous Next.js cache layer is gone (Convex caches its
 * own queries).
 */

import { fetchQuery } from 'convex/nextjs';
import { connection } from 'next/server';
import { derivePhase, type Phase } from '@/lib/phase';
import type { StageName } from '@/lib/workflows/lib/db-writes';
import { api } from '../../../convex/_generated/api';

export type PipelineRunRow = {
  id: string;
  specialtySlug: string;
  status: string;
  workflowRunId: string | null;
  startedAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
  error: string | null;
  contentOutlineUrls: unknown;
  identifyModulesInstructions: string | null;
  extractCodesInstructions: string | null;
  milestonesInstructions: string | null;
  mappingInstructions: string | null;
  mappingCheckIds: boolean;
  mappingFilter: { categories?: string[]; codes?: string[] } | null;
};

export type PipelineStageRow = {
  id: string;
  runId: string;
  stage: string;
  status: string;
  workflowRunId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  outputSummary: unknown;
  draftPayload: unknown;
  errorMessage: string | null;
};

export type PipelineEventRow = {
  id: string;
  runId: string;
  stage: string;
  level: string;
  message: string;
  metrics: Record<string, unknown> | null;
  createdAt: Date;
};

export type StageContext = {
  stage: PipelineStageRow;
  runUrls: unknown;
  events: PipelineEventRow[];
};

type ConvexRun = {
  _id: string;
  specialtySlug: string;
  status: string;
  workflowRunId?: string;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  error?: string;
  contentOutlineUrls?: string;
  identifyModulesInstructions?: string;
  extractCodesInstructions?: string;
  milestonesInstructions?: string;
  mappingInstructions?: string;
  mappingCheckIds: boolean;
  mappingFilter?: string;
};

type ConvexStage = {
  _id: string;
  runId: string;
  stage: string;
  status: string;
  workflowRunId?: string;
  startedAt?: number;
  finishedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
  outputSummary?: string;
  draftPayload?: string;
  errorMessage?: string;
};

type ConvexEvent = {
  _id: string;
  runId: string;
  stage: string;
  level: string;
  message: string;
  metrics?: string;
  createdAt: number;
};

function parseJson<T>(s: string | undefined): T | null {
  if (s === undefined || s === null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function toRun(r: ConvexRun): PipelineRunRow {
  return {
    id: r._id,
    specialtySlug: r.specialtySlug,
    status: r.status,
    workflowRunId: r.workflowRunId ?? null,
    startedAt: new Date(r.startedAt),
    updatedAt: new Date(r.updatedAt),
    finishedAt: r.finishedAt !== undefined ? new Date(r.finishedAt) : null,
    error: r.error ?? null,
    contentOutlineUrls: parseJson(r.contentOutlineUrls),
    identifyModulesInstructions: r.identifyModulesInstructions ?? null,
    extractCodesInstructions: r.extractCodesInstructions ?? null,
    milestonesInstructions: r.milestonesInstructions ?? null,
    mappingInstructions: r.mappingInstructions ?? null,
    mappingCheckIds: r.mappingCheckIds,
    mappingFilter: parseJson(r.mappingFilter),
  };
}

function toStage(r: ConvexStage): PipelineStageRow {
  return {
    id: r._id,
    runId: r.runId,
    stage: r.stage,
    status: r.status,
    workflowRunId: r.workflowRunId ?? null,
    startedAt: r.startedAt !== undefined ? new Date(r.startedAt) : null,
    finishedAt: r.finishedAt !== undefined ? new Date(r.finishedAt) : null,
    approvedAt: r.approvedAt !== undefined ? new Date(r.approvedAt) : null,
    approvedBy: r.approvedBy ?? null,
    outputSummary: parseJson(r.outputSummary),
    draftPayload: parseJson(r.draftPayload),
    errorMessage: r.errorMessage ?? null,
  };
}

function toEvent(r: ConvexEvent): PipelineEventRow {
  return {
    id: r._id,
    runId: r.runId,
    stage: r.stage,
    level: r.level,
    message: r.message,
    metrics: parseJson(r.metrics),
    createdAt: new Date(r.createdAt),
  };
}

/**
 * The "current" run for a specialty: the most recent non-terminal run if any
 * exists; otherwise the most recent of any status. Null if no runs.
 */
export async function getCurrentPipelineRun(
  slug: string,
): Promise<PipelineRunRow | null> {
  await connection();
  const r = await fetchQuery(api.pipeline.getCurrentRun, { slug });
  return r ? toRun(r as ConvexRun) : null;
}

export async function listPipelineRuns(slug: string): Promise<PipelineRunRow[]> {
  await connection();
  const rows = await fetchQuery(api.pipeline.listRuns, { slug });
  return (rows as ConvexRun[]).map(toRun);
}

export async function listPipelineStages(
  runId: string,
  _slug: string,
): Promise<PipelineStageRow[]> {
  await connection();
  const rows = await fetchQuery(api.pipeline.listStages, { runId });
  return (rows as ConvexStage[]).map(toStage);
}

export async function listPipelineEvents(
  runId: string,
  _slug: string,
): Promise<PipelineEventRow[]> {
  await connection();
  const rows = await fetchQuery(api.pipeline.listEvents, { runId });
  return (rows as ConvexEvent[]).map(toEvent);
}

export async function getLatestStageContexts(
  slug: string,
): Promise<Partial<Record<StageName, StageContext>>> {
  await connection();
  const raw = await fetchQuery(api.pipeline.getLatestStageContexts, { slug });
  const out: Partial<Record<StageName, StageContext>> = {};
  for (const [stageName, ctx] of Object.entries(raw)) {
    const c = ctx as {
      stage: ConvexStage;
      runUrls: string | null;
      events: ConvexEvent[];
    };
    out[stageName as StageName] = {
      stage: toStage(c.stage),
      runUrls: parseJson<unknown>(c.runUrls ?? undefined),
      events: c.events.map(toEvent),
    };
  }
  return out;
}

export type MapCodesHistory = {
  runs: PipelineRunRow[];
  events: PipelineEventRow[];
};

export async function getMapCodesHistory(slug: string): Promise<MapCodesHistory> {
  await connection();
  const r = await fetchQuery(api.pipeline.getMapCodesHistory, { slug });
  return {
    runs: (r.runs as ConvexRun[]).map(toRun),
    events: (r.events as ConvexEvent[]).map(toEvent),
  };
}

/**
 * Phase lookup for the home-page specialty grid. One query returns the most
 * recent run status per specialty; result is keyed by slug.
 */
export async function listSpecialtyPhases(): Promise<Record<string, Phase>> {
  await connection();
  const map = await fetchQuery(api.pipeline.listSpecialtyPhases);
  const out: Record<string, Phase> = {};
  for (const [slug, status] of Object.entries(map)) {
    out[slug] = derivePhase({ status: status as string });
  }
  return out;
}
