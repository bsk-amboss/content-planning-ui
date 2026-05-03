/**
 * Shared validators reused across domain schema modules.
 *
 * `jsonBlob` (v.any) is used for blobs whose values are pure scalars or
 * arrays of scalars — those are safe in Convex as-is.
 *
 * `jsonBlobString` is used for nested-record blobs whose KEYS may contain
 * unicode (e.g. `Vitamin B₁₂`). Convex requires ASCII-only field names
 * everywhere, so these get JSON.stringify'd on the way in and JSON.parse'd
 * at the consumer boundary (see `src/lib/convex-blobs.ts` and the workflow
 * write helpers). Phase B2 of the architecture cleanup is normalising
 * these to typed array-of-records — until then this is the boundary.
 */

import { v } from 'convex/values';

export const jsonBlob = v.any();
export const jsonBlobString = v.optional(v.string());

/**
 * Shared field set for the three article-suggestion tables
 * (`newArticleSuggestions`, `articleUpdateSuggestions`).
 * `consolidatedArticles` has a different shape so it gets its own table
 * definition.
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
  codes: jsonBlobString,
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
