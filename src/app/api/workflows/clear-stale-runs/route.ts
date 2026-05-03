/**
 * Cancel non-terminal pipeline runs for a specialty without touching data.
 *
 * POST /api/workflows/clear-stale-runs
 *   body: { specialtySlug: string }
 *   → 200 { ok: true, cancelled: number }
 *
 * Used by the Map codes "Continue mapping" flow: a previous remap-code or
 * partial map_codes run can crash without finalising its pipeline_runs row,
 * leaving `status='running'` and pinning the dashboard in "Run in progress."
 * This route flips those rows to `cancelled` so getCurrentPipelineRun stops
 * reporting an active run, but keeps every mapped code intact — unlike
 * /api/workflows/reset-stage, which cascades through stage data.
 */

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { requireUserResponse } from '@/lib/auth';
import { clearStaleRunsForSpecialty } from '@/lib/workflows/lib/reset';

type Body = {
  specialtySlug?: string;
};

export async function POST(req: NextRequest) {
  const guard = await requireUserResponse();
  if (guard) return guard;
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.specialtySlug) {
    return NextResponse.json({ error: 'specialtySlug required' }, { status: 400 });
  }

  console.log('[clear-stale-runs]', body);
  try {
    const cancelled = await clearStaleRunsForSpecialty(body.specialtySlug);
    revalidateTag(`pipeline:${body.specialtySlug}`, 'max');
    revalidateTag('specialty-phases', 'max');
    return NextResponse.json({ ok: true, cancelled });
  } catch (err) {
    console.error('[clear-stale-runs] failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
