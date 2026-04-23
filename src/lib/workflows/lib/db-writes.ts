/**
 * Step functions that own every pipeline write.
 *
 * All exports are `"use step"` so they retry on transient failure and persist
 * their results to the workflow event log. Workflow functions never touch the
 * DB directly — they call these helpers.
 */

import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  codes as codesTable,
  extractedCodes,
  pipelineRuns,
  pipelineStages,
  specialties,
} from '@/lib/db/schema';
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
    description: c.description ?? null,
    source: c.source ?? null,
    metadata: c.metadata ?? null,
  }));
  await db.insert(extractedCodes).values(rows);
  return { inserted: rows.length };
}

/**
 * Promote approved rows from extracted_codes into the production `codes`
 * table, leaving every mapping-specific column null so the mapping stage can
 * fill them in.
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
    specialtySlug,
    code: s.code,
    category: s.category,
    description: s.description,
    source: s.source,
    metadata: s.metadata,
  }));
  await db.insert(codesTable).values(rows);
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
  const db = getDb();
  await db
    .update(specialties)
    .set({ milestones })
    .where(eq(specialties.slug, specialtySlug));
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
  const db = getDb();
  const [row] = await db
    .select({
      region: specialties.region,
      language: specialties.language,
      milestones: specialties.milestones,
    })
    .from(specialties)
    .where(eq(specialties.slug, specialtySlug))
    .limit(1);
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
 * (`isInAmboss IS NULL`), optionally narrowed to specific categories or
 * individual codes. Kept in its own step so the mapping workflow's initial
 * load replays from the event log on crash instead of re-querying.
 */
export async function listUnmappedCodes(
  specialtySlug: string,
  filter?: MappingFilter | null,
): Promise<UnmappedCodeRow[]> {
  'use step';
  console.log('[pipeline] listUnmappedCodes', { specialtySlug, filter });
  const db = getDb();
  const catList = filter?.categories?.filter(
    (s) => typeof s === 'string' && s.length > 0,
  );
  const codeList = filter?.codes?.filter((s) => typeof s === 'string' && s.length > 0);
  const hasCat = Boolean(catList && catList.length > 0);
  const hasCode = Boolean(codeList && codeList.length > 0);
  const conditions = [
    eq(codesTable.specialtySlug, specialtySlug),
    isNull(codesTable.isInAmboss),
  ];
  // Use `inArray` (→ `IN (?, ?, ?)` with one bind per value) instead of
  // `ANY($n)`. The neon-serverless / Drizzle pairing passes arrays to `ANY`
  // incorrectly — values with embedded commas get split at the wire layer,
  // which blows up on category strings like "Abuse, Neglect, and ...".
  if (hasCat && hasCode && catList && codeList) {
    const clause = or(
      inArray(codesTable.category, catList),
      inArray(codesTable.code, codeList),
    );
    if (clause) conditions.push(clause);
  } else if (hasCat && catList) {
    conditions.push(inArray(codesTable.category, catList));
  } else if (hasCode && codeList) {
    conditions.push(inArray(codesTable.code, codeList));
  }
  const rows = await db
    .select({
      code: codesTable.code,
      category: codesTable.category,
      description: codesTable.description,
    })
    .from(codesTable)
    .where(and(...conditions));
  console.log('[pipeline] listUnmappedCodes →', rows.length);
  return rows;
}

/**
 * Write-through of a single mapping into the canonical `codes` row. Called
 * per-code from the mapping workflow immediately after the agent returns, so
 * the Codes tab reflects progress live.
 */
export async function writeCodeMapping(
  specialtySlug: string,
  code: string,
  mapping: MappingOutput,
): Promise<void> {
  'use step';
  console.log('[pipeline] writeCodeMapping', { specialtySlug, code });
  const db = getDb();
  const coverageScore =
    typeof mapping.coverage.coverageScore === 'number'
      ? mapping.coverage.coverageScore
      : typeof mapping.coverage.coverageScore === 'string'
        ? Number.parseInt(mapping.coverage.coverageScore, 10) || null
        : null;
  await db
    .update(codesTable)
    .set({
      isInAmboss: mapping.coverage.inAMBOSS ?? null,
      articlesWhereCoverageIs: mapping.coverage.coveredSections ?? null,
      notes: mapping.coverage.generalNotes || null,
      gaps: mapping.coverage.gaps || null,
      coverageLevel: mapping.coverage.coverageLevel || null,
      depthOfCoverage: coverageScore,
      existingArticleUpdates: mapping.suggestion.sectionUpdates ?? null,
      newArticlesNeeded: mapping.suggestion.newArticlesNeeded ?? null,
      improvements: mapping.suggestion.improvement || null,
      metadata: mapping.currentAMBOSSContentMetadata ?? null,
      fullJsonOutput: mapping as unknown as Record<string, unknown>,
    })
    .where(and(eq(codesTable.specialtySlug, specialtySlug), eq(codesTable.code, code)));
}
