/**
 * Internal cache-invalidation endpoint.
 *
 * Called from the workflow sandbox (which cannot `revalidateTag` directly) via
 * the `revalidateSpecialtyCache` step. POST `{ tags: string[], secret?: string }`.
 *
 * If `INTERNAL_REVALIDATE_SECRET` is set in the environment, the body `secret`
 * must match. Unset = dev-mode (no guard).
 */

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

type Body = {
  tags?: unknown;
  secret?: unknown;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const expected = process.env.INTERNAL_REVALIDATE_SECRET;
  if (expected && body.secret !== expected) {
    console.warn('[internal-revalidate] rejected: bad secret');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const tags = Array.isArray(body.tags)
    ? (body.tags.filter((t) => typeof t === 'string' && t.length > 0) as string[])
    : [];
  if (tags.length === 0) {
    return NextResponse.json(
      { error: 'tags must be a non-empty array of strings' },
      { status: 400 },
    );
  }

  for (const t of tags) {
    revalidateTag(t, 'max');
  }
  console.log('[internal-revalidate] invalidated', tags);
  return NextResponse.json({ ok: true, tags });
}
