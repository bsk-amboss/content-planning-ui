/**
 * Backfill a synthetic completed pipeline run so the dashboard reflects state
 * imported outside of the workflow (e.g. `db:seed` + `db:import-milestones`).
 *
 * Inserts one `pipeline_runs` row (status='completed') and one
 * `pipeline_stages` row per stage requested (status='completed',
 * approvedBy='import'). Output summaries record what was imported.
 *
 * Usage:
 *   npm run db:mark-imported -- anesthesiology codes milestones
 *   npm run db:mark-imported -- anesthesiology codes
 */

import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  codes as codesTable,
  pipelineRuns,
  pipelineStages,
  specialties,
} from '@/lib/db/schema';

type Stage = 'codes' | 'milestones';
const STAGE_NAME: Record<Stage, 'extract_codes' | 'extract_milestones'> = {
  codes: 'extract_codes',
  milestones: 'extract_milestones',
};

async function main() {
  const [slug, ...stageArgs] = process.argv.slice(2);
  if (!slug || stageArgs.length === 0) {
    console.error('Usage: db:mark-imported -- <slug> <codes|milestones> [...]');
    process.exit(1);
  }
  const stages = stageArgs.map((s) => {
    if (s !== 'codes' && s !== 'milestones') {
      throw new Error(`unknown stage '${s}' — expected 'codes' or 'milestones'`);
    }
    return s as Stage;
  });

  const db = getDb();

  const [spec] = await db
    .select({ slug: specialties.slug, milestones: specialties.milestones })
    .from(specialties)
    .where(eq(specialties.slug, slug))
    .limit(1);
  if (!spec) {
    console.error(`No specialty '${slug}'.`);
    process.exit(1);
  }

  const codeCount = stages.includes('codes')
    ? Number(
        (
          await db
            .select({ n: sql<number>`count(*)::int` })
            .from(codesTable)
            .where(eq(codesTable.specialtySlug, slug))
        )[0]?.n ?? 0,
      )
    : 0;
  const milestoneChars = stages.includes('milestones')
    ? (spec.milestones?.length ?? 0)
    : 0;

  if (stages.includes('codes') && codeCount === 0) {
    console.warn('[mark-imported] codes stage requested but no codes rows exist.');
  }
  if (stages.includes('milestones') && milestoneChars === 0) {
    console.warn(
      '[mark-imported] milestones stage requested but specialty has no milestones text.',
    );
  }

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
        : { source: 'manual_import', milestones_chars: milestoneChars };
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
