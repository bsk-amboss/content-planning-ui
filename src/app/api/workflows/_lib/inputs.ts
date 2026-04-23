/**
 * Shared input validator for workflow trigger routes.
 *
 * Both `/api/workflows/extract` and `/api/workflows/extract-milestones` take
 * the same `{ source, url }[]` payload — this module centralizes the
 * validation so the two routes can't drift.
 */

import { type ContentInput, isValidSourceSlug } from '@/lib/workflows/lib/sources';

export function parseContentInputs(
  raw: unknown,
  allowedSlugs: string[],
): ContentInput[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'inputs must be a non-empty array of { source, url } objects' };
  }
  const out: ContentInput[] = [];
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== 'object') {
      return { error: `inputs[${i}] must be an object` };
    }
    const source = (item as { source?: unknown }).source;
    const url = (item as { url?: unknown }).url;
    if (
      !isValidSourceSlug(
        source,
        allowedSlugs.map((slug) => ({ slug, name: slug })),
      )
    ) {
      return {
        error: `inputs[${i}].source must be one of: ${allowedSlugs.join(', ')}`,
      };
    }
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return { error: `inputs[${i}].url must be an http(s) URL` };
    }
    out.push({ source, url });
  }
  return out;
}
