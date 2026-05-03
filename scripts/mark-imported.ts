/**
 * Backfill a synthetic completed pipeline run so the dashboard reflects state
 * imported outside of the workflow (e.g. seed-convex + import-milestones).
 *
 * Inserts one Convex pipelineRuns row + one pipelineStages row per requested
 * stage (status='completed', approvedBy='import'). Output summaries record
 * what was imported (codes count, milestones length).
 *
 * Usage:
 *   npm run mark-imported -- anesthesiology codes milestones mapping
 *   npm run mark-imported -- anesthesiology codes
 */

import { api } from '../convex/_generated/api';
import { convexClient } from './_lib/convex';

type Stage = 'codes' | 'milestones' | 'mapping';
const STAGE_NAME: Record<Stage, 'extract_codes' | 'extract_milestones' | 'map_codes'> = {
  codes: 'extract_codes',
  milestones: 'extract_milestones',
  mapping: 'map_codes',
};

async function main() {
  const [slug, ...stageArgs] = process.argv.slice(2);
  if (!slug || stageArgs.length === 0) {
    console.error('Usage: db:mark-imported -- <slug> <codes|milestones|mapping> [...]');
    process.exit(1);
  }
  const stages = stageArgs.map((s) => {
    if (s !== 'codes' && s !== 'milestones' && s !== 'mapping') {
      throw new Error(
        `unknown stage '${s}' — expected 'codes', 'milestones', or 'mapping'`,
      );
    }
    return s as Stage;
  });

  const convex = convexClient();

  const spec = await convex.query(api.specialties.get, { slug });
  if (!spec) {
    console.error(`No specialty '${slug}' in Convex.`);
    process.exit(1);
  }

  const codeCount =
    stages.includes('codes') || stages.includes('mapping')
      ? (await convex.query(api.codes.list, { slug })).length
      : 0;
  const milestoneChars = stages.includes('milestones')
    ? (spec.milestones?.length ?? 0)
    : 0;

  if (stages.includes('codes') && codeCount === 0) {
    console.warn(
      '[mark-imported] codes stage requested but Convex has no codes for this specialty.',
    );
  }
  if (stages.includes('mapping') && codeCount === 0) {
    console.warn(
      '[mark-imported] mapping stage requested but no codes — synthetic map_codes will report mapped: 0.',
    );
  }
  if (stages.includes('milestones') && milestoneChars === 0) {
    console.warn(
      '[mark-imported] milestones stage requested but specialty has no milestones text in Convex.',
    );
  }

  const { id: runId } = await convex.mutation(api.pipeline.createRun, {
    specialtySlug: slug,
  });
  const now = Date.now();
  await convex.mutation(api.pipeline.updateRun, {
    runId,
    patch: { status: 'completed', finishedAt: now },
  });

  for (const stage of stages) {
    const stageName = STAGE_NAME[stage];
    const outputSummary =
      stage === 'codes'
        ? { source: 'manual_import', codes: codeCount }
        : stage === 'milestones'
          ? { source: 'manual_import', milestones_chars: milestoneChars }
          : { source: 'manual_import', mapped: codeCount };
    await convex.mutation(api.pipeline.initStage, { runId, stage: stageName });
    await convex.mutation(api.pipeline.updateStage, {
      runId,
      stage: stageName,
      patch: {
        status: 'completed',
        startedAt: now,
        finishedAt: now,
        approvedAt: now,
        approvedBy: 'import',
        outputSummary: JSON.stringify(outputSummary),
      },
    });
  }

  console.log(
    `✓ Backfilled run ${runId} for '${slug}' — stages: ${stages.map((s) => STAGE_NAME[s]).join(', ')}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
