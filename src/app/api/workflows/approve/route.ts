/**
 * Resume a paused approval hook.
 *
 * POST /api/workflows/approve
 *   body: {
 *     runId: string;
 *     stage: 'extract_codes' | 'extract_milestones';
 *     approved: boolean;
 *     approvedBy?: string;
 *     note?: string;
 *   }
 *
 * Uses the deterministic `approve:<runId>:<stage>` token so the route doesn't
 * need to know the hook id — the paused workflow is waiting on that exact
 * token via `createHook`.
 */

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { resumeHook } from 'workflow/api';
import { type ApprovableStage, approvalToken } from '@/lib/workflows/lib/approval';

type Body = {
  runId?: string;
  specialtySlug?: string;
  stage?: ApprovableStage;
  approved?: boolean;
  approvedBy?: string;
  note?: string;
};

const APPROVABLE_STAGES: ReadonlySet<ApprovableStage> = new Set([
  'extract_codes',
  'extract_milestones',
]);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }
  if (!body.stage || !APPROVABLE_STAGES.has(body.stage)) {
    return NextResponse.json(
      { error: `stage must be one of ${[...APPROVABLE_STAGES].join(', ')}` },
      { status: 400 },
    );
  }
  if (typeof body.approved !== 'boolean') {
    return NextResponse.json({ error: 'approved (boolean) required' }, { status: 400 });
  }

  const token = approvalToken(body.runId, body.stage);
  console.log('[approve] resuming hook', {
    runId: body.runId,
    stage: body.stage,
    approved: body.approved,
  });
  await resumeHook(token, {
    approved: body.approved,
    approvedBy: body.approvedBy,
    note: body.note,
  });

  if (body.specialtySlug) {
    revalidateTag(`pipeline:${body.specialtySlug}`, 'max');
    revalidateTag(`codes:${body.specialtySlug}`, 'max');
    revalidateTag(`specialty:${body.specialtySlug}`, 'max');
  }
  revalidateTag('specialty-phases', 'max');
  revalidateTag('specialties', 'max');

  return NextResponse.json({ ok: true });
}
