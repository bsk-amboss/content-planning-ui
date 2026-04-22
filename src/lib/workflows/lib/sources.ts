/**
 * Content source helpers.
 *
 * A single pipeline run can mix PDFs/URLs from multiple sources. The source
 * slug is used as the `code` prefix (e.g. `ab_<slug>_0001`) and stored on
 * both `extracted_codes` and `codes` rows. The set of valid source slugs
 * lives in the `code_sources` DB table — users can add more from the
 * pipeline dashboard — so nothing here is hardcoded beyond the import-script
 * seeds and the normalization fallback.
 */

export type CodeSource = { slug: string; name: string };
export type ContentInput = { source: string; url: string };

export function sourceLabel(slug: string, sources: CodeSource[] = []): string {
  return sources.find((s) => s.slug === slug)?.name ?? slug;
}

export function isValidSourceSlug(
  value: unknown,
  sources: CodeSource[],
): value is string {
  return typeof value === 'string' && sources.some((s) => s.slug === value);
}

/**
 * Accept either the new `{source, url}[]` shape or the legacy `string[]` shape
 * (old pipeline_runs.contentOutlineUrls rows from before per-input sources).
 * `fallback` is the source applied to legacy string entries or objects with
 * a missing/invalid source.
 */
export function normalizeInputs(raw: unknown, fallback = 'ab'): ContentInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ContentInput[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.startsWith('http')) {
      out.push({ source: fallback, url: item });
      continue;
    }
    if (
      item &&
      typeof item === 'object' &&
      'url' in item &&
      typeof (item as { url: unknown }).url === 'string'
    ) {
      const url = (item as { url: string }).url;
      const source = (item as { source?: unknown }).source;
      if (!url.startsWith('http')) continue;
      out.push({
        source: typeof source === 'string' && source ? source : fallback,
        url,
      });
    }
  }
  return out;
}
