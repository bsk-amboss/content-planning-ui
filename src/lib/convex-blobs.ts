/**
 * Helpers for hydrating Convex rows into the runtime shapes the rest of the
 * app expects.
 *
 * Background: a few jsonb columns on the editor-facing tables (codes:
 * `articlesWhereCoverageIs` / `existingArticleUpdates` / `newArticlesNeeded`;
 * articles + sections + suggestions: `codes`) hold arrays of records whose
 * keys are user-content (section titles, article titles). Convex requires
 * ASCII-only field names everywhere — including in the values it serialises
 * back to clients — so we store these blobs as JSON-stringified strings on
 * the Convex side. Parsing happens at the boundary between Convex's wire
 * format and the consumers (UI components / SSR data helpers), via these
 * helpers.
 *
 * Used from BOTH server contexts (`fetchQuery` callers under `src/lib/data`)
 * and client contexts (the Convex `useQuery` / `usePreloadedQuery` callers).
 */

const CODE_BLOB_FIELDS = [
  'articlesWhereCoverageIs',
  'existingArticleUpdates',
  'newArticlesNeeded',
] as const;

function parseField<T extends Record<string, unknown>>(row: T, field: string): T {
  const raw = row[field];
  if (typeof raw !== 'string') return row;
  try {
    return { ...row, [field]: JSON.parse(raw) };
  } catch {
    return row;
  }
}

export function hydrateCode<T extends Record<string, unknown>>(row: T): T {
  let out = row;
  for (const f of CODE_BLOB_FIELDS) out = parseField(out, f);
  return out;
}

export function hydrateCodes<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(hydrateCode);
}

export function hydrateCodesBlob<T extends Record<string, unknown>>(row: T): T {
  return parseField(row, 'codes');
}

export function hydrateCodesBlobs<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(hydrateCodesBlob);
}
