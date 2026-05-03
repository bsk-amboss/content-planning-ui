/**
 * Code sources CRUD endpoints.
 *
 *   GET  /api/code-sources              → list all sources
 *   POST /api/code-sources { slug, name } → create new source
 */

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { requireUserResponse } from '@/lib/auth';
import { createCodeSource, listCodeSources } from '@/lib/data/code-sources';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

export async function GET() {
  const guard = await requireUserResponse();
  if (guard) return guard;
  const rows = await listCodeSources();
  return NextResponse.json({ sources: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireUserResponse();
  if (guard) return guard;
  const body = (await req.json().catch(() => ({}))) as {
    slug?: unknown;
    name?: unknown;
  };
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: 'slug must match [a-z0-9][a-z0-9_-]*' },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  try {
    const row = await createCodeSource({ slug, name });
    revalidateTag('code-sources', 'max');
    return NextResponse.json({ source: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const conflict = msg.toLowerCase().includes('unique');
    return NextResponse.json(
      { error: conflict ? `slug "${slug}" already exists` : msg },
      { status: conflict ? 409 : 500 },
    );
  }
}
