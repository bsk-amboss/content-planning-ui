/**
 * Step functions that own every pipeline write.
 *
 * All exports are `"use step"` so they retry on transient failure and persist
 * their results to the workflow event log. Workflow functions never touch the
 * DB directly — they call these helpers.
 *
 * After the Convex migration: pipeline_runs / pipeline_stages /
 * pipeline_events / extracted_codes still live in Postgres (Vercel Workflow's
 * durability layer is intertwined with that schema). Editor-facing rows
 * (codes, articles, sections, categories, specialty milestones) live in
 * Convex — those steps call Convex mutations via `fetchMutation` so all
 * connected clients see updates live.
 */

import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { extractedCodes, pipelineRuns, pipelineStages } from '@/lib/db/schema';
import { api } from '../../../../convex/_generated/api';
import type { MappingOutput } from './amboss-mcp';
import type { RawExtractedCode } from './gemini';

export type PipelineRunStatus =
  | 'running'
  | 'awaiting_preprocessing_approval'
  | 'mapping'
  | 'consolidating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StageName =
  | 'extract_codes'
  | 'extract_milestones'
  | 'map_codes'
  | 'consolidate_primary'
  | 'consolidate_articles'
  | 'consolidate_sections';

export type StageStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'completed'
  | 'failed'
  | 'skipped';

// --- pipeline_runs -----------------------------------------------------------

export async function createPipelineRun(input: {
  specialtySlug: string;
  workflowRunId?: string;
}): Promise<{ id: string }> {
  'use step';
  console.log('[pipeline] createPipelineRun', input);
  const db = getDb();
  const [row] = await db
    .insert(pipelineRuns)
    .values({
      specialtySlug: input.specialtySlug,
      workflowRunId: input.workflowRunId ?? null,
      status: 'running',
    })
    .returning({ id: pipelineRuns.id });
  console.log('[pipeline] createPipelineRun →', row.id);
  return row;
}

export async function updatePipelineRunStatus(
  runId: string,
  status: PipelineRunStatus,
  error?: string | null,
): Promise<void> {
  'use step';
  console.log('[pipeline] updatePipelineRunStatus', { runId, status, error });
  const db = getDb();
  const terminal =
    status === 'completed' || status === 'failed' || status === 'cancelled';
  await db
    .update(pipelineRuns)
    .set({
      status,
      updatedAt: new Date(),
      ...(terminal ? { finishedAt: new Date() } : {}),
      ...(error !== undefined ? { error } : {}),
    })
    .where(eq(pipelineRuns.id, runId));
}

// --- pipeline_stages ---------------------------------------------------------

export async function initPipelineStage(
  runId: string,
  stage: StageName,
): Promise<{ id: string }> {
  'use step';
  console.log('[pipeline] initPipelineStage', { runId, stage });
  const db = getDb();
  const [row] = await db
    .insert(pipelineStages)
    .values({ runId, stage, status: 'pending' })
    .returning({ id: pipelineStages.id });
  return row;
}

export async function markStageRunning(
  runId: string,
  stage: StageName,
  workflowRunId?: string,
): Promise<void> {
  'use step';
  console.log('[pipeline] markStageRunning', { runId, stage, workflowRunId });
  const db = getDb();
  await db
    .update(pipelineStages)
    .set({
      status: 'running',
      startedAt: new Date(),
      ...(workflowRunId ? { workflowRunId } : {}),
    })
    .where(and(eq(pipelineStages.runId, runId), eq(pipelineStages.stage, stage)));
}

export async function markStageAwaitingApproval(
  runId: string,
  stage: StageName,
  outputSummary: Record<string, unknown>,
  draftPayload?: unknown,
): Promise<void> {
  'use step';
  console.log('[pipeline] markStageAwaitingApproval', { runId, stage, outputSummary });
  const db = getDb();
  await db
    .update(pipelineStages)
    .set({
      status: 'awaiting_approval',
      outputSummary,
      ...(draftPayload !== undefined ? { draftPayload } : {}),
    })
    .where(and(eq(pipelineStages.runId, runId), eq(pipelineStages.stage, stage)));
}

export async function markStageCompleted(
  runId: string,
  stage: StageName,
  approvedBy?: string,
  outputSummary?: Record<string, unknown>,
): Promise<void> {
  'use step';
  console.log('[pipeline] markStageCompleted', { runId, stage, approvedBy });
  const db = getDb();
  await db
    .update(pipelineStages)
    .set({
      status: 'completed',
      finishedAt: new Date(),
      ...(approvedBy ? { approvedAt: new Date(), approvedBy } : {}),
      ...(outputSummary ? { outputSummary } : {}),
    })
    .where(and(eq(pipelineStages.runId, runId), eq(pipelineStages.stage, stage)));
}

export async function markStageFailed(
  runId: string,
  stage: StageName,
  errorMessage: string,
): Promise<void> {
  'use step';
  console.log('[pipeline] markStageFailed', { runId, stage, errorMessage });
  const db = getDb();
  await db
    .update(pipelineStages)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      errorMessage,
    })
    .where(and(eq(pipelineStages.runId, runId), eq(pipelineStages.stage, stage)));
}

// --- extracted_codes ---------------------------------------------------------

export async function writeExtractedCodes(
  runId: string,
  specialtySlug: string,
  rawCodes: RawExtractedCode[],
): Promise<{ inserted: number }> {
  'use step';
  console.log('[pipeline] writeExtractedCodes', {
    runId,
    specialtySlug,
    count: rawCodes.length,
  });
  if (rawCodes.length === 0) return { inserted: 0 };
  const db = getDb();
  const rows = rawCodes.map((c) => ({
    runId,
    specialtySlug,
    code: c.code,
    category: c.category ?? null,
    consolidationCategory: c.consolidationCategory ?? null,
    description: c.description ?? null,
    source: c.source ?? null,
    metadata: c.metadata ?? null,
  }));
  await db.insert(extractedCodes).values(rows);
  return { inserted: rows.length };
}

/**
 * Promote approved rows from extracted_codes (Postgres staging) into the
 * production `codes` collection in Convex, leaving every mapping-specific
 * field unset so the mapping stage can fill them in. metadata is dropped on
 * the way through — the audit confirmed the UI never reads it on the codes
 * row, and the schema doesn't carry a column for it.
 */
export async function promoteExtractedCodesToCodes(
  runId: string,
  specialtySlug: string,
): Promise<{ promoted: number }> {
  'use step';
  console.log('[pipeline] promoteExtractedCodesToCodes', { runId, specialtySlug });
  const db = getDb();
  const staged = await db
    .select()
    .from(extractedCodes)
    .where(eq(extractedCodes.runId, runId));
  if (staged.length === 0) return { promoted: 0 };
  const rows = staged.map((s) => ({
    code: s.code,
    category: s.category ?? undefined,
    consolidationCategory: s.consolidationCategory ?? undefined,
    description: s.description ?? undefined,
    source: s.source ?? undefined,
  }));
  // Chunk to stay under Convex's free-tier write-rate cap (4 MiB/s) the same
  // way the seed script does.
  const chunkSize = 25;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await fetchMutation(api.codes.bulkInsert, { slug: specialtySlug, rows: chunk });
  }
  console.log('[pipeline] promoteExtractedCodesToCodes → promoted', rows.length);
  return { promoted: rows.length };
}

// --- specialties.milestones --------------------------------------------------

export async function writeApprovedMilestones(
  specialtySlug: string,
  milestones: string,
): Promise<void> {
  'use step';
  console.log('[pipeline] writeApprovedMilestones', {
    specialtySlug,
    chars: milestones.length,
  });
  await fetchMutation(api.specialties.updateMilestones, {
    slug: specialtySlug,
    milestones,
    bumpSeedTimestamp: true,
  });
}

export type SpecialtyMappingContext = {
  region: string | null;
  language: string | null;
  milestones: string | null;
};

/**
 * One-shot fetch of the specialty fields the mapping workflow needs. Not
 * cached — the workflow runs this as a step at startup, so the event log
 * picks it up from the cached step value on replay.
 */
export async function loadSpecialtyForMapping(
  specialtySlug: string,
): Promise<SpecialtyMappingContext> {
  'use step';
  console.log('[pipeline] loadSpecialtyForMapping', { specialtySlug });
  const row = await fetchQuery(api.specialties.get, { slug: specialtySlug });
  return {
    region: row?.region ?? null,
    language: row?.language ?? null,
    milestones: row?.milestones ?? null,
  };
}

// --- codes (mapping writes) --------------------------------------------------

export type UnmappedCodeRow = {
  code: string;
  category: string | null;
  description: string | null;
};

/** Optional filter applied to the unmapped-codes query. */
export type MappingFilter = {
  /** Restrict to codes whose `category` is in this list. */
  categories?: string[];
  /** Restrict to specific `code` values (takes precedence when combined with
   *  categories: both filters union — a row matches if it's in either list). */
  codes?: string[];
};

/**
 * All rows for a specialty that the mapping workflow hasn't touched yet
 * (`isInAMBOSS` unset), optionally narrowed to specific categories or
 * individual codes. Kept in its own step so the mapping workflow's initial
 * load replays from the event log on crash instead of re-querying.
 */
export async function listUnmappedCodes(
  specialtySlug: string,
  filter?: MappingFilter | null,
): Promise<UnmappedCodeRow[]> {
  'use step';
  console.log('[pipeline] listUnmappedCodes', { specialtySlug, filter });
  const rows = await fetchQuery(api.codes.listUnmapped, {
    slug: specialtySlug,
    categories: filter?.categories?.filter((s) => typeof s === 'string' && s.length > 0),
    codes: filter?.codes?.filter((s) => typeof s === 'string' && s.length > 0),
  });
  console.log('[pipeline] listUnmappedCodes →', rows.length);
  return rows;
}

/**
 * Write-through of a single mapping into the canonical `codes` row. Called
 * per-code from the mapping workflow immediately after the agent returns, so
 * the Codes tab reflects progress live across all editors via Convex's
 * reactive queries. The mutation also clears the in-flight marker for this
 * code in the same transaction.
 *
 * Blob-shaped fields (covered sections, section updates, new article
 * suggestions) are JSON-stringified before passing — the Convex schema
 * stores them as strings to dodge the ASCII-only field-name restriction
 * since the existing payloads use unicode-bearing strings as JSON keys
 * (e.g. section titles like "Vitamin B₁₂"). Read-side query handlers
 * JSON.parse them back, so UI consumers don't see the wire format.
 */
export async function writeCodeMapping(
  specialtySlug: string,
  code: string,
  mapping: MappingOutput,
): Promise<void> {
  'use step';
  console.log('[pipeline] writeCodeMapping', { specialtySlug, code });
  const coverageScore =
    typeof mapping.coverage.coverageScore === 'number'
      ? mapping.coverage.coverageScore
      : typeof mapping.coverage.coverageScore === 'string'
        ? Number.parseInt(mapping.coverage.coverageScore, 10) || undefined
        : undefined;
  await fetchMutation(api.codes.writeMapping, {
    slug: specialtySlug,
    code,
    isInAMBOSS: mapping.coverage.inAMBOSS ?? undefined,
    coverageLevel: mapping.coverage.coverageLevel || undefined,
    depthOfCoverage: coverageScore,
    notes: mapping.coverage.generalNotes || undefined,
    gaps: mapping.coverage.gaps || undefined,
    improvements: mapping.suggestion.improvement || undefined,
    articlesWhereCoverageIs: mapping.coverage.coveredSections
      ? JSON.stringify(mapping.coverage.coveredSections)
      : undefined,
    existingArticleUpdates: mapping.suggestion.sectionUpdates
      ? JSON.stringify(mapping.suggestion.sectionUpdates)
      : undefined,
    newArticlesNeeded: mapping.suggestion.newArticlesNeeded
      ? JSON.stringify(mapping.suggestion.newArticlesNeeded)
      : undefined,
  });
}

/**
 * Clear mapping-derived fields for a single code so it can be remapped from
 * scratch. Mirrors the per-specialty clear in `reset.ts` but scoped to one
 * row; used by the per-row "Remap" action.
 */
export async function clearMappingForCode(
  specialtySlug: string,
  code: string,
): Promise<void> {
  console.log('[pipeline] clearMappingForCode', { specialtySlug, code });
  await fetchMutation(api.codes.clearMapping, { slug: specialtySlug, code });
}

/**
 * Mark a batch of codes as in-flight at the start of a map_codes batch.
 * Drives the live MappingPulse indicator on the codes table — every
 * connected client sees the pulse appear without polling because the
 * `inFlight` Convex query is reactive. Each entry is cleared inline by
 * `writeCodeMapping` once that code finishes.
 */
export async function markCodesInFlight(
  specialtySlug: string,
  codes: string[],
  runId: string,
): Promise<void> {
  'use step';
  console.log('[pipeline] markCodesInFlight', {
    specialtySlug,
    runId,
    count: codes.length,
  });
  if (codes.length === 0) return;
  await fetchMutation(api.codes.markInFlight, { slug: specialtySlug, codes, runId });
}

/**
 * Drop every in-flight marker for a run — called when the workflow finishes
 * (success, failure, or cancellation) to make sure no zombie pulses linger
 * on rows whose batch crashed before `writeCodeMapping` could clear them.
 */
export async function clearInFlightForRun(runId: string): Promise<void> {
  'use step';
  console.log('[pipeline] clearInFlightForRun', { runId });
  await fetchMutation(api.codes.clearInFlightForRun, { runId });
}
