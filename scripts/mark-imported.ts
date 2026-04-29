/**
 * Backfill a synthetic completed pipeline run so the dashboard reflects state
 * imported outside of the workflow (e.g. seed-convex + import-milestones).
 *
 * Inserts one `pipeline_runs` row (status='completed') and one
 * `pipeline_stages` row per stage requested (status='completed',
 * approvedBy='import'). Output summaries record what was imported.
 *
 * Counts are read from Convex (codes count, milestones length) since the
 * editor data lives there post-migration. Pipeline rows still land in
 * Postgres until Phase 3 of the consolidation moves them too.
 *
 * Usage:
 *   pnpm db:mark-imported -- anesthesiology codes milestones mapping
 *   pnpm db:mark-imported -- anesthesiology codes
 */

import { ConvexHttpClient } from 'convex/browser';
import { env } from '@/env';
import { getDb } from '@/lib/db';
import { pipelineRuns, pipelineStages } from '@/lib/db/schema';
import { api } from '../convex/_generated/api';

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

  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
  }
  const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

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

  const db = getDb();
  const now = new Date();
  const [run] = await db
    .insert(pipelineRuns)
    .values({
      specialtySlug: slug,
      status: 'completed',
      startedAt: now,
      updatedAt: now,
      finishedAt: now,
    })
    .returning({ id: pipelineRuns.id });

  for (const stage of stages) {
    const stageName = STAGE_NAME[stage];
    const outputSummary =
      stage === 'codes'
        ? { source: 'manual_import', codes: codeCount }
        : stage === 'milestones'
          ? { source: 'manual_import', milestones_chars: milestoneChars }
          : { source: 'manual_import', mapped: codeCount };
    await db.insert(pipelineStages).values({
      runId: run.id,
      stage: stageName,
      status: 'completed',
      startedAt: now,
      finishedAt: now,
      approvedAt: now,
      approvedBy: 'import',
      outputSummary,
    });
  }

  console.log(
    `✓ Backfilled run ${run.id} for '${slug}' — stages: ${stages.map((s) => STAGE_NAME[s]).join(', ')}`,
  );
  console.log(
    `  Now revalidate caches: curl -X POST http://localhost:3000/api/internal/revalidate -H 'content-type: application/json' -d '{"tags":["pipeline:${slug}","specialty-phases","specialties"]}'`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
