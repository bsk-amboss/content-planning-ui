/**
 * Stage-reset helpers.
 *
 * Resetting a stage clears its output artifacts AND cascades through every
 * downstream stage (since their inputs just disappeared). Used by the
 * /api/workflows/reset-stage route.
 */

import { fetchMutation } from 'convex/nextjs';
import { and, eq, notInArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  extractedCodes,
  pipelineEvents,
  pipelineRuns,
  pipelineStages,
} from '@/lib/db/schema';
import { api } from '../../../../convex/_generated/api';
import type { StageName } from './db-writes';

const DOWNSTREAM: Record<StageName, StageName[]> = {
  extract_codes: [
    'map_codes',
    'consolidate_primary',
    'consolidate_articles',
    'consolidate_sections',
  ],
  extract_milestones: [],
  map_codes: ['consolidate_primary', 'consolidate_articles', 'consolidate_sections'],
  consolidate_primary: ['consolidate_articles', 'consolidate_sections'],
  consolidate_articles: ['consolidate_sections'],
  consolidate_sections: [],
};

export function stagesToReset(stage: StageName): StageName[] {
  return [stage, ...DOWNSTREAM[stage]];
}

async function clearStageData(stage: StageName, specialtySlug: string, runId: string) {
  const db = getDb();
  switch (stage) {
    case 'extract_codes':
      // Staging rows for this run live in Postgres; promoted codes live in
      // Convex and are wiped via the cascading delete mutation.
      await db.delete(extractedCodes).where(eq(extractedCodes.runId, runId));
      await fetchMutation(api.codes.deleteForSpecialty, { slug: specialtySlug });
      break;
    case 'extract_milestones':
      await fetchMutation(api.specialties.updateMilestones, {
        slug: specialtySlug,
        milestones: undefined,
      });
      break;
    case 'map_codes':
      // Bulk-clear the mapping fields on every code in the specialty (the
      // mutation skips rows that are already unmapped). Also drops any
      // in-flight markers in the same transaction.
      await fetchMutation(api.codes.clearAllMappingsForSpecialty, {
        slug: specialtySlug,
      });
      break;
    case 'consolidate_primary':
      await fetchMutation(api.articles.deleteNewForSpecialty, { slug: specialtySlug });
      await fetchMutation(api.articles.deleteUpdatesForSpecialty, {
        slug: specialtySlug,
      });
      break;
    case 'consolidate_articles':
      await fetchMutation(api.articles.deleteConsolidatedForSpecialty, {
        slug: specialtySlug,
      });
      break;
    case 'consolidate_sections':
      await fetchMutation(api.sections.deleteForSpecialty, { slug: specialtySlug });
      break;
  }
}

/**
 * Reset the given stage and every downstream stage for the run. Also marks the
 * pipeline run as `cancelled` so the UI stops treating it as active — the user
 * can immediately start a fresh run. Returns the stages that were cleared.
 */
export async function resetStageCascade(input: {
  runId: string;
  specialtySlug: string;
  stage: StageName;
}): Promise<StageName[]> {
  const db = getDb();
  const toReset = stagesToReset(input.stage);
  for (const s of toReset) {
    await clearStageData(s, input.specialtySlug, input.runId);
    // Purge the event log for this stage so the card's Log panel starts
    // empty when the stage is re-run.
    await db
      .delete(pipelineEvents)
      .where(and(eq(pipelineEvents.runId, input.runId), eq(pipelineEvents.stage, s)));
    await db
      .update(pipelineStages)
      .set({
        status: 'pending',
        startedAt: null,
        finishedAt: null,
        approvedAt: null,
        approvedBy: null,
        outputSummary: null,
        draftPayload: null,
        errorMessage: null,
      })
      .where(and(eq(pipelineStages.runId, input.runId), eq(pipelineStages.stage, s)));
  }
  // Cancel every non-terminal pipeline run for this specialty — not just the
  // stage's owning run. Per-code remap-code calls and partial map_codes runs
  // each get their own pipeline_runs row; if one of them crashed mid-flight
  // it keeps `status='running'`, and getCurrentPipelineRun will keep telling
  // the dashboard a run is active. Resetting any stage is the user signalling
  // "clear the slate," so it should sweep these zombies too.
  await db
    .update(pipelineRuns)
    .set({
      status: 'cancelled',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pipelineRuns.specialtySlug, input.specialtySlug),
        notInArray(pipelineRuns.status, ['completed', 'failed', 'cancelled']),
      ),
    );
  return toReset;
}

/**
 * Cancel every non-terminal pipeline run for a specialty without touching
 * stage data, mappings, or extracted codes. Use this when the dashboard is
 * stuck in "Run in progress" because of a zombie run (e.g. crashed
 * remap-code) but the user wants to keep the data they have and start a new
 * run on top of it. Returns the count of runs cancelled.
 */
export async function clearStaleRunsForSpecialty(specialtySlug: string): Promise<number> {
  const db = getDb();
  const result = await db
    .update(pipelineRuns)
    .set({
      status: 'cancelled',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pipelineRuns.specialtySlug, specialtySlug),
        notInArray(pipelineRuns.status, ['completed', 'failed', 'cancelled']),
      ),
    )
    .returning({ id: pipelineRuns.id });
  return result.length;
}
