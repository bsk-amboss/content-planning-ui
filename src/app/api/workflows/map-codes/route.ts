/**
 * Trigger endpoint for the map-codes workflow.
 *
 * POST /api/workflows/map-codes
 *   body: {
 *     specialtySlug: string;
 *     contentBase?: string;                 // default derived from specialty.region
 *     language?: string;                    // default derived from specialty.language
 *     additionalInstructions?: string;      // appended to DEFAULT_MAPPING_SYSTEM_PROMPT
 *     checkAgainstLibrary?: boolean;        // default true
 *     categories?: string[];                // limit mapping to rows with category in this list
 *     codes?: string[];                     // additionally include these specific codes
 *   }
 *
 * Verifies there is at least one unmapped code matching the filter (409 when
 * the filter excludes everything), creates a pipeline_runs row + map_codes
 * stage, and starts the workflow.
 */

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { requireUserResponse } from '@/lib/auth';
import { fetchMutationAsUser, fetchQueryAsUser } from '@/lib/convex/server';
import { approvalToken } from '@/lib/workflows/lib/approval';
import type { MappingFilter } from '@/lib/workflows/lib/db-writes';
import { mapCodesWorkflow } from '@/lib/workflows/mapping/map-codes';
import { api } from '../../../../../convex/_generated/api';

type Body = {
  specialtySlug?: string;
  contentBase?: string;
  language?: string;
  additionalInstructions?: string;
  checkAgainstLibrary?: boolean;
  categories?: unknown;
  codes?: unknown;
};

function stringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.length > 0) out.push(trimmed);
    }
  }
  return out.length > 0 ? [...new Set(out)] : undefined;
}

/**
 * Count unmapped rows that match the filter, so we can fail fast with a 409
 * when the filter excludes everything instead of spawning an empty workflow.
 */
async function countUnmappedWithFilter(
  slug: string,
  filter: MappingFilter | null,
): Promise<number> {
  const rows = await fetchQueryAsUser(api.codes.listUnmapped, {
    slug,
    categories: filter?.categories ?? undefined,
    codes: filter?.codes ?? undefined,
  });
  return rows.length;
}

export async function POST(req: NextRequest) {
  const guard = await requireUserResponse();
  if (guard) return guard;
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.specialtySlug;
  if (!slug) {
    return NextResponse.json({ error: 'specialtySlug required' }, { status: 400 });
  }

  const spec = await fetchQueryAsUser(api.specialties.get, { slug });
  if (!spec) {
    return NextResponse.json({ error: `specialty not found: ${slug}` }, { status: 404 });
  }

  const filterCategories = stringArray(body.categories);
  const filterCodes = stringArray(body.codes);
  const filter: MappingFilter | null =
    filterCategories || filterCodes
      ? { categories: filterCategories, codes: filterCodes }
      : null;

  const unmappedCount = await countUnmappedWithFilter(slug, filter);
  if (unmappedCount === 0) {
    return NextResponse.json(
      {
        error: filter
          ? 'No unmapped codes match the selected categories or codes.'
          : 'No unmapped codes for this specialty. Reset the mapping stage to remap everything, or run extract codes first.',
      },
      { status: 409 },
    );
  }

  const checkAgainstLibrary = body.checkAgainstLibrary !== false;
  const mappingInstructions = body.additionalInstructions?.trim() || null;

  const { id: runId } = await fetchMutationAsUser(api.pipeline.createRun, {
    specialtySlug: slug,
  });
  await fetchMutationAsUser(api.pipeline.updateRun, {
    runId,
    patch: {
      mappingInstructions,
      mappingCheckIds: checkAgainstLibrary,
      ...(filter ? { mappingFilter: filter } : {}),
    },
  });
  await fetchMutationAsUser(api.pipeline.initStage, { runId, stage: 'map_codes' });

  const wfRun = await start(mapCodesWorkflow, [
    {
      runId,
      specialtySlug: slug,
      contentBase: body.contentBase?.trim() || undefined,
      language: body.language?.trim() || undefined,
      additionalInstructions: mappingInstructions ?? undefined,
      checkAgainstLibrary,
      filter,
    },
  ]);

  await fetchMutationAsUser(api.pipeline.updateRun, {
    runId,
    patch: { workflowRunId: wfRun.runId },
  });

  revalidateTag(`pipeline:${slug}`, 'max');
  revalidateTag('specialty-phases', 'max');

  return NextResponse.json({
    runId,
    workflowRunId: wfRun.runId,
    specialty: slug,
    unmappedCount,
    approvalToken: approvalToken(runId, 'map_codes'),
  });
}
