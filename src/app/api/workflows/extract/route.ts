/**
 * Trigger endpoint for the extract-codes workflow.
 *
 * POST /api/workflows/extract
 *   body: {
 *     specialtySlug: string;
 *     inputs: Array<{ source: 'ab' | 'orphanet' | 'icd10'; url: string }>;
 *     identifyModulesInstructions?: string;
 *     extractCodesInstructions?: string;
 *   }
 *
 * Responsibility:
 *   1. Verify the specialty exists in Convex.
 *   2. Create a pipelineRuns row + the extract_codes stage.
 *   3. Call `start(extractCodesWorkflow, ...)` and record the workflow run id.
 */

import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { listCodeSources } from '@/lib/data/code-sources';
import { approvalToken } from '@/lib/workflows/lib/approval';
import { extractCodesWorkflow } from '@/lib/workflows/preprocessing/extract-codes';
import { api } from '../../../../../convex/_generated/api';
import { parseContentInputs } from '../_lib/inputs';

type Body = {
  specialtySlug?: string;
  inputs?: unknown;
  identifyModulesInstructions?: string;
  extractCodesInstructions?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.specialtySlug;
  if (!slug) {
    return NextResponse.json({ error: 'specialtySlug required' }, { status: 400 });
  }
  const sourceRows = await listCodeSources();
  const allowedSlugs = sourceRows.map((r) => r.slug);
  const parsed = parseContentInputs(body.inputs, allowedSlugs);
  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const inputs = parsed;

  const spec = await fetchQuery(api.specialties.get, { slug });
  if (!spec) {
    return NextResponse.json({ error: `specialty not found: ${slug}` }, { status: 404 });
  }

  const identifyInstructions = body.identifyModulesInstructions?.trim() || null;
  const extractInstructions = body.extractCodesInstructions?.trim() || null;

  const { id: runId } = await fetchMutation(api.pipeline.createRun, {
    specialtySlug: slug,
  });
  await fetchMutation(api.pipeline.updateRun, {
    runId,
    patch: {
      contentOutlineUrls: JSON.stringify(inputs),
      ...(identifyInstructions
        ? { identifyModulesInstructions: identifyInstructions }
        : {}),
      ...(extractInstructions ? { extractCodesInstructions: extractInstructions } : {}),
    },
  });
  await fetchMutation(api.pipeline.initStage, { runId, stage: 'extract_codes' });

  const wfRun = await start(extractCodesWorkflow, [
    {
      runId,
      specialtySlug: slug,
      inputs,
      identifyInstructions: identifyInstructions ?? undefined,
      extractInstructions: extractInstructions ?? undefined,
    },
  ]);

  await fetchMutation(api.pipeline.updateRun, {
    runId,
    patch: { workflowRunId: wfRun.runId },
  });

  revalidateTag(`pipeline:${slug}`, 'max');
  revalidateTag('specialty-phases', 'max');

  return NextResponse.json({
    runId,
    workflowRunId: wfRun.runId,
    specialty: slug,
    inputs: inputs.length,
    approvalToken: approvalToken(runId, 'extract_codes'),
  });
}
