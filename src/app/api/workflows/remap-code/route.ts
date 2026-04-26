/**
 * Remap a single code from the codes table.
 *
 * POST /api/workflows/remap-code
 *   body: { specialtySlug, code, contentBase?, language?, checkAgainstLibrary? }
 *
 * Flow:
 *   1. Verify the specialty exists and consolidation is not locked. (A locked
 *      specialty also blocks this endpoint — reset consolidation first.)
 *   2. Clear mapping fields on this one code so the mapping workflow's
 *      `isInAmboss IS NULL` filter picks it up.
 *   3. Create a fresh pipeline_run + map_codes stage row and start the
 *      workflow with `filter.codes = [code]`.
 *
 * Use /api/workflows/map-codes directly for unmapped codes; this endpoint is
 * specifically for re-mapping an already-mapped row.
 */

import { and, eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { getConsolidationLockState } from '@/lib/data/codes';
import { getDb } from '@/lib/db';
import {
  codes as codesTable,
  pipelineRuns,
  pipelineStages,
  specialties,
} from '@/lib/db/schema';
import { approvalToken } from '@/lib/workflows/lib/approval';
import { clearMappingForCode } from '@/lib/workflows/lib/db-writes';
import { mapCodesWorkflow } from '@/lib/workflows/mapping/map-codes';

type Body = {
  specialtySlug?: string;
  code?: string;
  contentBase?: string;
  language?: string;
  checkAgainstLibrary?: boolean;
  additionalInstructions?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.specialtySlug?.trim();
  const code = body.code?.trim();
  if (!slug || !code) {
    return NextResponse.json(
      { error: 'specialtySlug and code required' },
      { status: 400 },
    );
  }

  console.log('[remap-code]', { slug, code });

  const lock = await getConsolidationLockState(slug);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: 'Consolidation is active — reset the consolidation stage to remap codes.',
      },
      { status: 409 },
    );
  }

  const db = getDb();
  const [spec] = await db.select().from(specialties).where(eq(specialties.slug, slug));
  if (!spec) {
    return NextResponse.json({ error: `specialty not found: ${slug}` }, { status: 404 });
  }

  const [existing] = await db
    .select({ code: codesTable.code })
    .from(codesTable)
    .where(and(eq(codesTable.specialtySlug, slug), eq(codesTable.code, code)));
  if (!existing) {
    return NextResponse.json({ error: `code not found: ${code}` }, { status: 404 });
  }

  // Null the mapping fields first so listUnmappedCodes picks the row up.
  await clearMappingForCode(slug, code);

  const checkAgainstLibrary = body.checkAgainstLibrary !== false;
  const mappingInstructions = body.additionalInstructions?.trim() || null;
  const filter = { codes: [code] } as const;

  const [run] = await db
    .insert(pipelineRuns)
    .values({
      specialtySlug: slug,
      status: 'running',
      mappingInstructions,
      mappingCheckIds: checkAgainstLibrary,
      mappingFilter: filter,
    })
    .returning({ id: pipelineRuns.id });

  await db
    .insert(pipelineStages)
    .values({ runId: run.id, stage: 'map_codes', status: 'pending' });

  const wfRun = await start(mapCodesWorkflow, [
    {
      runId: run.id,
      specialtySlug: slug,
      contentBase: body.contentBase?.trim() || undefined,
      language: body.language?.trim() || undefined,
      additionalInstructions: mappingInstructions ?? undefined,
      checkAgainstLibrary,
      filter: { codes: [code] },
    },
  ]);

  await db
    .update(pipelineRuns)
    .set({ workflowRunId: wfRun.runId, updatedAt: new Date() })
    .where(eq(pipelineRuns.id, run.id));

  revalidateTag(`pipeline:${slug}`, 'max');
  revalidateTag(`codes:${slug}`, 'max');
  revalidateTag('specialty-phases', 'max');

  return NextResponse.json({
    runId: run.id,
    workflowRunId: wfRun.runId,
    specialty: slug,
    code,
    approvalToken: approvalToken(run.id, 'map_codes'),
  });
}
