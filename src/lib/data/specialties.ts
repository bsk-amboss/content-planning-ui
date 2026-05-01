import { fetchQuery } from 'convex/nextjs';
import { connection } from 'next/server';
import type { Specialty } from '@/lib/repositories/types';
import { api } from '../../../convex/_generated/api';

// Specialties live in Convex now. SSR pages call these helpers and get a
// snapshot via `fetchQuery`; client components that mount inside the page
// can subscribe live via `useQuery(api.specialties.list)` directly.
//
// `'use cache'` and `cacheTag`/`cacheLife` are gone here on purpose — Convex
// already caches and invalidates automatically. Re-introducing Next's cache
// layer would just add staleness without saving any work.

// The Convex row carries `_id`/`_creationTime` plus a few workflow-managed
// fields the existing UI Specialty type doesn't model. Project to the leaner
// shape so callers stay typed against the same `Specialty` they were before.
type ConvexSpecialty = {
  slug: string;
  name: string;
  source: string;
  sheetId?: string;
  xlsxPath?: string;
};

function toSpecialty(row: ConvexSpecialty): Specialty {
  return {
    slug: row.slug,
    name: row.name,
    // The repo-typed Specialty narrows source to `'sheets'|'xlsx'` for the
    // legacy Sheets/xlsx backends; in Convex we also see 'manual' from the
    // /api/specialties POST. Keep the runtime value untouched and cast — UI
    // call-sites already string-equality-check the variants they care about.
    source: row.source as Specialty['source'],
    sheetId: row.sheetId,
    xlsxPath: row.xlsxPath,
  };
}

// `await connection()` marks each call as request-time so Next 16's
// `cacheComponents` static prerender doesn't try to statically inline the
// Convex fetch (which uses Math.random() for request ids and trips the
// `next-prerender-random` rule otherwise).
export async function listSpecialties(): Promise<Specialty[]> {
  await connection();
  const rows = await fetchQuery(api.specialties.list);
  return rows.map(toSpecialty);
}

export async function getSpecialty(slug: string): Promise<Specialty | null> {
  await connection();
  const row = await fetchQuery(api.specialties.get, { slug });
  return row ? toSpecialty(row) : null;
}

/**
 * Approved milestones blob for a specialty. Lives on `specialties.milestones`
 * (plain text, written at the end of the extract-milestones workflow). Returns
 * `null` when the pipeline hasn't produced any yet.
 */
export async function getMilestones(slug: string): Promise<string | null> {
  await connection();
  const row = await fetchQuery(api.specialties.get, { slug });
  return row?.milestones ?? null;
}
