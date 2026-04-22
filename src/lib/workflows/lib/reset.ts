/**
 * Stage-reset helpers.
 *
 * Resetting a stage clears its output artifacts AND cascades through every
 * downstream stage (since their inputs just disappeared). Used by the
 * /api/workflows/reset-stage route.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  articleUpdateSuggestions,
  codes as codesTable,
  consolidatedArticles,
  consolidatedSections,
  extractedCodes,
  newArticleSuggestions,
  pipelineEvents,
  pipelineRuns,
  pipelineStages,
  specialties,
} from '@/lib/db/schema';
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
      // Staging rows for this run + every promoted code for the specialty.
      // (codes has no run_id today — reset wipes all codes for the specialty.)
      await db.delete(extractedCodes).where(eq(extractedCodes.runId, runId));
      await db.delete(codesTable).where(eq(codesTable.specialtySlug, specialtySlug));
      break;
    case 'extract_milestones':
      await db
        .update(specialties)
        .set({ milestones: null })
        .where(eq(specialties.slug, specialtySlug));
      break;
    case 'map_codes':
      // Clear only mapping fields on any codes that survived. If extract_codes
      // was already cascaded, this is a no-op on zero rows.
      await db
        .update(codesTable)
        .set({
          isInAmboss: null,
          articlesWhereCoverageIs: null,
          notes: null,
          gaps: null,
          coverageLevel: null,
          depthOfCoverage: null,
          existingArticleUpdates: null,
          newArticlesNeeded: null,
          improvements: null,
          fullJsonOutput: null,
        })
        .where(
          and(
            eq(codesTable.specialtySlug, specialtySlug),
            // Don't clobber rows that are already unmapped.
            sql`${codesTable.isInAmboss} IS NOT NULL OR ${codesTable.coverageLevel} IS NOT NULL`,
          ),
        );
      break;
    case 'consolidate_primary':
      await db
        .delete(newArticleSuggestions)
        .where(eq(newArticleSuggestions.specialtySlug, specialtySlug));
      await db
        .delete(articleUpdateSuggestions)
        .where(eq(articleUpdateSuggestions.specialtySlug, specialtySlug));
      break;
    case 'consolidate_articles':
      await db
        .delete(consolidatedArticles)
        .where(eq(consolidatedArticles.specialtySlug, specialtySlug));
      break;
    case 'consolidate_sections':
      await db
        .delete(consolidatedSections)
        .where(eq(consolidatedSections.specialtySlug, specialtySlug));
      break;
  }
  // Suppress unused-var warning when the schema imports isn't needed in a branch.
  void isNull;
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
  await db
    .update(pipelineRuns)
    .set({
      status: 'cancelled',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pipelineRuns.id, input.runId));
  return toReset;
}
