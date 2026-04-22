/**
 * Trigger endpoint for the extract-codes workflow.
 *
 * POST /api/workflows/extract
 *   body: {
 *     specialtySlug: string;
 *     contentOutlineUrls: string[];        // required — PDFs to extract from
 *     extractionSystemPrompt?: string;     // optional per-run override
 *   }
 *
 * Responsibility:
 *   1. Verify the specialty exists.
 *   2. Create a pipeline_runs row (with the URLs/prompt snapshot) + the
 *      extract_codes stage.
 *   3. Call `start(extractCodesWorkflow, ...)` and record the workflow run id.
 *
 * This is a focused Step-4 endpoint. The full `/api/workflows/run` orchestrator
 * (which wires preprocessing → mapping → consolidation) lands in Step 7.
 */

import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { getDb } from '@/lib/db';
import { pipelineRuns, pipelineStages, specialties } from '@/lib/db/schema';
import { approvalToken } from '@/lib/workflows/lib/approval';
import { extractCodesWorkflow } from '@/lib/workflows/preprocessing/extract-codes';

type Body = {
  specialtySlug?: string;
  contentOutlineUrls?: unknown;
  extractionSystemPrompt?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.specialtySlug;
  if (!slug) {
    return NextResponse.json({ error: 'specialtySlug required' }, { status: 400 });
  }
  const urls = Array.isArray(body.contentOutlineUrls)
    ? (body.contentOutlineUrls.filter(
        (u) => typeof u === 'string' && u.length > 0,
      ) as string[])
    : [];
  if (urls.length === 0) {
    return NextResponse.json(
      { error: 'contentOutlineUrls must be a non-empty array of URLs' },
      { status: 400 },
    );
  }

  const db = getDb();
  const [spec] = await db.select().from(specialties).where(eq(specialties.slug, slug));
  if (!spec) {
    return NextResponse.json({ error: `specialty not found: ${slug}` }, { status: 404 });
  }

  const prompt = body.extractionSystemPrompt ?? '';

  const [run] = await db
    .insert(pipelineRuns)
    .values({
      specialtySlug: slug,
      status: 'running',
      contentOutlineUrls: urls,
      extractionSystemPrompt: prompt,
    })
    .returning({ id: pipelineRuns.id });

  await db
    .insert(pipelineStages)
    .values({ runId: run.id, stage: 'extract_codes', status: 'pending' });

  const wfRun = await start(extractCodesWorkflow, [
    {
      runId: run.id,
      specialtySlug: slug,
      contentOutlineUrls: urls,
      systemPrompt: prompt,
    },
  ]);

  await db
    .update(pipelineRuns)
    .set({ workflowRunId: wfRun.runId, updatedAt: new Date() })
    .where(eq(pipelineRuns.id, run.id));

  revalidateTag(`pipeline:${slug}`, 'max');
  revalidateTag('specialty-phases', 'max');

  return NextResponse.json({
    runId: run.id,
    workflowRunId: wfRun.runId,
    specialty: slug,
    urls: urls.length,
    approvalToken: approvalToken(run.id, 'extract_codes'),
  });
}
