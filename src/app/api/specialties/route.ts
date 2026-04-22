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

import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { specialties } from '@/lib/db/schema';

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
  const body = (await req.json().catch(() => ({}))) as Body;
  const slug = body.slug ? sanitizeSlug(body.slug) : '';
  const name = body.name?.trim() ?? '';
  if (!slug || !name) {
    return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
  }

  const db = getDb();
  try {
    const [row] = await db
      .insert(specialties)
      .values({
        slug,
        name,
        source: 'manual',
        region: body.region?.trim() || null,
        language: body.language?.trim() || null,
      })
      .returning({ slug: specialties.slug, name: specialties.name });

    revalidateTag('specialties', 'max');
    return NextResponse.json({ specialty: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('duplicate key') || msg.includes('unique')) {
      return NextResponse.json(
        { error: `specialty '${slug}' already exists` },
        { status: 409 },
      );
    }
    console.error('[POST /api/specialties] failed:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
