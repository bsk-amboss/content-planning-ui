/**
 * Reset a pipeline stage (and everything downstream) to `pending`.
 *
 * POST /api/workflows/reset-stage
 *   body: {
 *     runId: string;
 *     specialtySlug: string;
 *     stage: StageName;
 *   }
 *
 * Destructive: deletes the stage's output artifacts for the specialty. Use
 * only when the stage is in a terminal state (completed / failed / skipped).
 */

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import type { StageName } from '@/lib/workflows/lib/db-writes';
import { resetStageCascade } from '@/lib/workflows/lib/reset';

const VALID_STAGES: ReadonlySet<StageName> = new Set([
  'extract_codes',
  'extract_milestones',
  'map_codes',
  'consolidate_primary',
  'consolidate_articles',
  'consolidate_sections',
]);

type Body = {
  runId?: string;
  specialtySlug?: string;
  stage?: StageName;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.runId || !body.specialtySlug) {
    return NextResponse.json(
      { error: 'runId and specialtySlug required' },
      { status: 400 },
    );
  }
  if (!body.stage || !VALID_STAGES.has(body.stage)) {
    return NextResponse.json(
      { error: `stage must be one of ${[...VALID_STAGES].join(', ')}` },
      { status: 400 },
    );
  }

  console.log('[reset-stage]', body);
  const reset = await resetStageCascade({
    runId: body.runId,
    specialtySlug: body.specialtySlug,
    stage: body.stage,
  });

  revalidateTag(`pipeline:${body.specialtySlug}`, 'max');
  revalidateTag('specialty-phases', 'max');

  return NextResponse.json({ ok: true, reset });
}
