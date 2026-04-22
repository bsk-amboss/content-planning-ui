/**
 * Cached reader + mutators for the `code_sources` registry.
 *
 * The start-run form's source dropdown and the stage-card's "Inputs" rendering
 * both derive labels from this list. Invalidate via `code-sources` tag after
 * create/delete so both surfaces refresh.
 */

import { asc, eq } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { codeSources } from '@/lib/db/schema';

export type CodeSourceRow = typeof codeSources.$inferSelect;

export async function listCodeSources(): Promise<CodeSourceRow[]> {
  'use cache';
  cacheTag('code-sources');
  cacheLife('minutes');
  const db = getDb();
  return db.select().from(codeSources).orderBy(asc(codeSources.name));
}

export async function createCodeSource(input: {
  slug: string;
  name: string;
}): Promise<CodeSourceRow> {
  const db = getDb();
  const [row] = await db
    .insert(codeSources)
    .values({ slug: input.slug, name: input.name })
    .returning();
  return row;
}

export async function deleteCodeSource(slug: string): Promise<void> {
  const db = getDb();
  await db.delete(codeSources).where(eq(codeSources.slug, slug));
}
