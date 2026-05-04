/**
 * Shared validators reused across domain schema modules.
 *
 * `jsonBlob` (v.any) is used for blobs whose values are pure scalars or
 * arrays of scalars — those are safe in Convex as-is.
 *
 * `jsonBlobString` is reserved for genuinely heterogeneous payloads whose
 * shape is per-event/per-stage (pipeline stage outputSummary/draftPayload,
 * pipeline event metrics, extracted-codes metadata). The structured blobs
 * that used to live in this category — codes mapping output, article/section
 * codes, content outline URLs, mapping filter — are now typed validators
 * (see below) so consumers get them already-parsed.
 */

import { v } from 'convex/values';

export const jsonBlob = v.any();
export const jsonBlobString = v.optional(v.string());

// --- Typed shapes for previously-stringified blobs --------------------------

/**
 * One section reference inside a covered article. The mapping workflow
 * normalises the LLM's `record<title, id>` form into this array form before
 * writing — see `src/lib/workflows/lib/db-writes.ts:writeCodeMapping`.
 */
export const sectionRefShape = v.object({
  sectionTitle: v.optional(v.string()),
  sectionId: v.optional(v.string()),
});

export const coveredSectionShape = v.object({
  articleTitle: v.optional(v.string()),
  articleId: v.optional(v.string()),
  sections: v.optional(v.array(sectionRefShape)),
});

export const sectionUpdateShape = v.object({
  articleTitle: v.optional(v.string()),
  articleId: v.optional(v.string()),
  sections: v.optional(
    v.array(
      v.object({
        sectionTitle: v.optional(v.string()),
        sectionId: v.optional(v.string()),
        exists: v.optional(v.boolean()),
        changes: v.optional(v.string()),
        importance: v.optional(v.number()),
      }),
    ),
  ),
});

export const newArticleShape = v.object({
  articleTitle: v.optional(v.string()),
  importance: v.optional(v.number()),
});

/**
 * `{source, url}` entry on `pipelineRuns.contentOutlineUrls`. Sources are
 * dropdown slugs from `codeSources` / `milestoneSources`.
 */
export const contentInputShape = v.object({
  source: v.string(),
  url: v.string(),
});

export const mappingFilterShape = v.object({
  categories: v.optional(v.array(v.string())),
  codes: v.optional(v.array(v.string())),
});

/**
 * Shared field set for the three article-suggestion tables
 * (`newArticleSuggestions`, `articleUpdateSuggestions`).
 * `consolidatedArticles` has a different shape so it gets its own table
 * definition.
 *
 * `codes` is `array of records` from the xlsx fixtures (ASCII keys —
 * `code`, `description`, etc.). We accept arbitrary entries (`v.any()`)
 * because the xlsx shape isn't strict enough to pin down here, and the
 * UI consumers cast to `Array<Record<string, unknown>>` at the boundary.
 */
export const articleSuggestionFields = {
  specialtySlug: v.string(),
  assignedEditor: v.optional(v.string()),
  editorInTheLoopReview: v.optional(v.string()),
  newArticle: v.optional(v.boolean()),
  articleMaintenance: v.optional(v.boolean()),
  articleTitle: v.optional(v.string()),
  alternateTitles: v.optional(v.string()),
  articleProgress: v.optional(v.string()),
  articleType: v.optional(v.string()),
  specialtyName: v.optional(v.string()),
  articleId: v.optional(v.string()),
  codes: v.optional(v.array(v.any())),
  literatureSearchTerms: v.optional(v.string()),
  sections: v.optional(v.string()),
  previousArticleTitleSuggestions: v.optional(jsonBlob),
  previousConsolidationIndexes: v.optional(jsonBlob),
  existingAmbossCoverage: v.optional(v.string()),
  overallImportance: v.optional(v.number()),
  justification: v.optional(v.string()),
  isSearched: v.optional(v.boolean()),
  llmSearchTerms: v.optional(v.string()),
  verdict: v.optional(v.string()),
  justifcation: v.optional(v.string()),
  isSufficientlyCovered: v.optional(v.boolean()),
  areAllSourcesFetched: v.optional(v.boolean()),
};
