/**
 * Stage-reset helpers. Resetting a stage clears its output artifacts AND
 * cascades through every downstream stage. Used by /api/workflows/reset-stage.
 */

import { fetchMutation } from 'convex/nextjs';
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

async function clearEditorDataForStage(stage: StageName, specialtySlug: string) {
  switch (stage) {
    case 'extract_codes':
      await fetchMutation(api.codes.deleteForSpecialty, { slug: specialtySlug });
      break;
    case 'extract_milestones':
      await fetchMutation(api.specialties.updateMilestones, {
        slug: specialtySlug,
        milestones: undefined,
      });
      break;
    case 'map_codes':
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
 * Reset the given stage and every downstream stage for the run. Also marks
 * every non-terminal pipeline run for the specialty as `cancelled` so the UI
 * stops treating any stale run as active.
 */
export async function resetStageCascade(input: {
  runId: string;
  specialtySlug: string;
  stage: StageName;
}): Promise<StageName[]> {
  const toReset = stagesToReset(input.stage);
  for (const s of toReset) {
    await clearEditorDataForStage(s, input.specialtySlug);
    await fetchMutation(api.pipeline.resetStage, { runId: input.runId, stage: s });
  }
  await fetchMutation(api.pipeline.cancelStaleRunsForSpecialty, {
    slug: input.specialtySlug,
  });
  return toReset;
}

/**
 * Cancel every non-terminal pipeline run for a specialty without touching
 * stage data, mappings, or extracted codes. Use this when the dashboard is
 * stuck in "Run in progress" because of a zombie run but the user wants to
 * keep the data they have. Returns the count of runs cancelled.
 */
export async function clearStaleRunsForSpecialty(specialtySlug: string): Promise<number> {
  const result = await fetchMutation(api.pipeline.cancelStaleRunsForSpecialty, {
    slug: specialtySlug,
  });
  return result.cancelled;
}
