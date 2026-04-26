/**
 * Per-code edit endpoint.
 *
 * PATCH /api/codes/[specialty]/[code]
 *   body: { description?, category?, consolidationCategory? }
 *
 * Gated on consolidation state — returns 409 if `consolidate_primary` is in
 * any state other than `pending`/`skipped`. The gate is also enforced in the
 * UI, but re-checked here so a stale tab can't bypass it.
 */

import { and, eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { getConsolidationLockState } from '@/lib/data/codes';
import { getDb } from '@/lib/db';
import { codes as codesTable } from '@/lib/db/schema';

type Body = {
  description?: string | null;
  category?: string | null;
  consolidationCategory?: string | null;
};

function cleanOpt(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ specialty: string; code: string }> },
) {
  const { specialty, code } = await params;
  const slug = decodeURIComponent(specialty);
  const codeId = decodeURIComponent(code);

  const lock = await getConsolidationLockState(slug);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: 'Consolidation is active — reset the consolidation stage to edit codes.',
      },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const description = cleanOpt(body.description);
  const category = cleanOpt(body.category);
  const consolidationCategory = cleanOpt(body.consolidationCategory);
  const anyField =
    description !== undefined ||
    category !== undefined ||
    consolidationCategory !== undefined;
  if (!anyField) {
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 });
  }
  console.log('[codes] PATCH', {
    slug,
    code: codeId,
    description,
    category,
    consolidationCategory,
  });

  const db = getDb();
  const result = await db
    .update(codesTable)
    .set({
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(consolidationCategory !== undefined ? { consolidationCategory } : {}),
    })
    .where(and(eq(codesTable.specialtySlug, slug), eq(codesTable.code, codeId)))
    .returning({ code: codesTable.code });

  if (result.length === 0) {
    return NextResponse.json({ error: 'code not found' }, { status: 404 });
  }

  revalidateTag(`codes:${slug}`, 'max');
  revalidateTag(`specialty:${slug}`, 'max');

  return NextResponse.json({ ok: true });
}
