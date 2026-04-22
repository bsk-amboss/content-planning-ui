/**
 * Trigger endpoint for the extract-codes workflow.
 *
 * POST /api/workflows/extract
 *   body: {
 *     specialtySlug: string;
 *     inputs: Array<{ source: 'ab' | 'orphanet' | 'icd10'; url: string }>;
 *     identifyModulesInstructions?: string;   // appended to DEFAULT_IDENTIFY_SYSTEM_PROMPT
 *     extractCodesInstructions?: string;      // appended to DEFAULT_EXTRACT_SYSTEM_PROMPT
 *   }
 *
 * Responsibility:
 *   1. Verify the specialty exists.
 *   2. Create a pipeline_runs row (with the inputs + per-phase instructions
 *      snapshot) + the extract_codes stage.
 *   3. Call `start(extractCodesWorkflow, ...)` and record the workflow run id.
 */

import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { listCodeSources } from '@/lib/data/code-sources';
import { getDb } from '@/lib/db';
import { pipelineRuns, pipelineStages, specialties } from '@/lib/db/schema';
import { approvalToken } from '@/lib/workflows/lib/approval';
import { type ContentInput, isValidSourceSlug } from '@/lib/workflows/lib/sources';
import { extractCodesWorkflow } from '@/lib/workflows/preprocessing/extract-codes';

type Body = {
  specialtySlug?: string;
  inputs?: unknown;
  identifyModulesInstructions?: string;
  extractCodesInstructions?: string;
};

function parseInputs(
  raw: unknown,
  allowedSlugs: string[],
): ContentInput[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'inputs must be a non-empty array of { source, url } objects' };
  }
  const out: ContentInput[] = [];
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== 'object') {
      return { error: `inputs[${i}] must be an object` };
    }
    const source = (item as { source?: unknown }).source;
    const url = (item as { url?: unknown }).url;
    if (
      !isValidSourceSlug(
        source,
        allowedSlugs.map((slug) => ({ slug, name: slug })),
      )
    ) {
      return {
        error: `inputs[${i}].source must be one of: ${allowedSlugs.join(', ')}`,
      };
    }
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return { error: `inputs[${i}].url must be an http(s) URL` };
    }
    out.push({ source, url });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.specialtySlug;
  if (!slug) {
    return NextResponse.json({ error: 'specialtySlug required' }, { status: 400 });
  }
  const sourceRows = await listCodeSources();
  const allowedSlugs = sourceRows.map((r) => r.slug);
  const parsed = parseInputs(body.inputs, allowedSlugs);
  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const inputs = parsed;

  const db = getDb();
  const [spec] = await db.select().from(specialties).where(eq(specialties.slug, slug));
  if (!spec) {
    return NextResponse.json({ error: `specialty not found: ${slug}` }, { status: 404 });
  }

  const identifyInstructions = body.identifyModulesInstructions?.trim() || null;
  const extractInstructions = body.extractCodesInstructions?.trim() || null;

  const [run] = await db
    .insert(pipelineRuns)
    .values({
      specialtySlug: slug,
      status: 'running',
      contentOutlineUrls: inputs,
      identifyModulesInstructions: identifyInstructions,
      extractCodesInstructions: extractInstructions,
    })
    .returning({ id: pipelineRuns.id });

  await db
    .insert(pipelineStages)
    .values({ runId: run.id, stage: 'extract_codes', status: 'pending' });

  const wfRun = await start(extractCodesWorkflow, [
    {
      runId: run.id,
      specialtySlug: slug,
      inputs,
      identifyInstructions: identifyInstructions ?? undefined,
      extractInstructions: extractInstructions ?? undefined,
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
    inputs: inputs.length,
    approvalToken: approvalToken(run.id, 'extract_codes'),
  });
}
