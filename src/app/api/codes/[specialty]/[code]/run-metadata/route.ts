/**
 * Per-code mapping run metadata.
 *
 * GET /api/codes/[specialty]/[code]/run-metadata
 *   → 200 { runId, totals, attempts, toolBreakdown, ... }
 *   → 404 when no map_codes run has touched this code yet
 *
 * Powers the Metadata tab in the code-detail modal. Read-only and lightly
 * cached at the loader layer (loadCodeMappingMetadata is uncached on purpose:
 * an in-flight run's events should appear without waiting for revalidation).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { loadCodeMappingMetadata } from '@/lib/data/code-run-metadata';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ specialty: string; code: string }> },
) {
  const { specialty, code } = await params;
  const slug = decodeURIComponent(specialty);
  const codeId = decodeURIComponent(code);
  const metadata = await loadCodeMappingMetadata(slug, codeId);
  if (!metadata) {
    return NextResponse.json({ error: 'no mapping run for this code' }, { status: 404 });
  }
  return NextResponse.json(metadata);
}
