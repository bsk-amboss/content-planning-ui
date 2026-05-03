/**
 * Specialty registration.
 *
 * POST /api/specialties
 *   body: {
 *     slug: string;          // required, lowercased+snake-cased
 *     name: string;          // required, display name
 *     region?: string;       // optional — 'us' | 'de' | ...
 *     language?: string;     // optional — 'en' | 'de' | ...
 *   }
 *
 * No URLs or prompts at this stage — those are per-run inputs supplied when
 * the user kicks off an extraction.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireUserResponse } from '@/lib/auth';
import { fetchMutationAsUser, fetchQueryAsUser } from '@/lib/convex/server';
import { api } from '../../../../convex/_generated/api';

function sanitizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

type Body = {
  slug?: string;
  name?: string;
  region?: string;
  language?: string;
};

export async function POST(req: NextRequest) {
  const guard = await requireUserResponse();
  if (guard) return guard;
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.slug ? sanitizeSlug(body.slug) : '';
  const name = body.name?.trim() ?? '';
  if (!slug || !name) {
    return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
  }

  // Pre-flight uniqueness check — Convex doesn't enforce a unique constraint
  // by itself, so we look up the slug first. The `create` mutation also
  // upserts, but we want to return the same 409 the old endpoint did.
  const existing = await fetchQueryAsUser(api.specialties.get, { slug });
  if (existing) {
    return NextResponse.json(
      { error: `specialty '${slug}' already exists` },
      { status: 409 },
    );
  }

  try {
    await fetchMutationAsUser(api.specialties.create, {
      slug,
      name,
      source: 'manual',
      region: body.region?.trim() || undefined,
      language: body.language?.trim() || undefined,
    });
    return NextResponse.json({ specialty: { slug, name } }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/specialties] failed:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
