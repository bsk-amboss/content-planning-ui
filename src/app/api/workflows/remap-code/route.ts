/**
 * Remap a single code from the codes table.
 *
 * POST /api/workflows/remap-code
 *   body: { specialtySlug, code, contentBase?, language?, checkAgainstLibrary? }
 */

import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { getConsolidationLockState } from '@/lib/data/codes';
import { approvalToken } from '@/lib/workflows/lib/approval';
import { clearMappingForCode } from '@/lib/workflows/lib/db-writes';
import { mapCodesWorkflow } from '@/lib/workflows/mapping/map-codes';
import { api } from '../../../../../convex/_generated/api';

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

  const spec = await fetchQuery(api.specialties.get, { slug });
  if (!spec) {
    return NextResponse.json({ error: `specialty not found: ${slug}` }, { status: 404 });
  }

  const existing = await fetchQuery(api.codes.get, { slug, code });
  if (!existing) {
    return NextResponse.json({ error: `code not found: ${code}` }, { status: 404 });
  }

  await clearMappingForCode(slug, code);

  const checkAgainstLibrary = body.checkAgainstLibrary !== false;
  const mappingInstructions = body.additionalInstructions?.trim() || null;
  const filter = { codes: [code] } as const;

  const { id: runId } = await fetchMutation(api.pipeline.createRun, {
    specialtySlug: slug,
  });
  await fetchMutation(api.pipeline.updateRun, {
    runId,
    patch: {
      mappingInstructions,
      mappingCheckIds: checkAgainstLibrary,
      mappingFilter: JSON.stringify(filter),
    },
  });
  await fetchMutation(api.pipeline.initStage, { runId, stage: 'map_codes' });

  const wfRun = await start(mapCodesWorkflow, [
    {
      runId,
      specialtySlug: slug,
      contentBase: body.contentBase?.trim() || undefined,
      language: body.language?.trim() || undefined,
      additionalInstructions: mappingInstructions ?? undefined,
      checkAgainstLibrary,
      filter: { codes: [code] },
    },
  ]);

  await fetchMutation(api.pipeline.updateRun, {
    runId,
    patch: { workflowRunId: wfRun.runId },
  });

  revalidateTag(`pipeline:${slug}`, 'max');
  revalidateTag(`codes:${slug}`, 'max');
  revalidateTag('specialty-phases', 'max');

  return NextResponse.json({
    runId,
    workflowRunId: wfRun.runId,
    specialty: slug,
    code,
    approvalToken: approvalToken(runId, 'map_codes'),
  });
}
