import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Reactive store for editor-facing data. Pipeline state, the workflow durability
// layer, and the read-only ontology tables (icd10/hcup/abim/orpha) stay on
// Postgres — see src/lib/db/schema.ts.

// JSON blob columns from Postgres jsonb. Convex requires ASCII-only field
// names everywhere — but the existing data uses user-content (section
// titles, article titles, etc.) as JSON object keys, which can contain
// unicode (e.g. `Vitamin B₁₂`). To preserve fidelity without rewriting the
// blob shape, we serialise these to strings on the way in and JSON.parse on
// the way out (see helpers in codes.ts / articles.ts / sections.ts).
//
// `jsonBlob` (v.any) is still used for blobs whose values are pure scalars
// or arrays of scalars — those are safe in Convex as-is.
// `jsonBlobString` is used for nested-record blobs.
const jsonBlob = v.any();
const jsonBlobString = v.optional(v.string());

const articleSuggestionFields = {
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

export default defineSchema({
  specialties: defineTable({
    slug: v.string(),
    name: v.string(),
    source: v.string(),
    sheetId: v.optional(v.string()),
    xlsxPath: v.optional(v.string()),
    lastSeededAt: v.optional(v.number()),
    milestones: v.optional(v.string()),
    region: v.optional(v.string()),
    language: v.optional(v.string()),
  }).index('by_slug', ['slug']),

  // Editor-facing rows. fullJsonOutput, metadata, rowIndex dropped — confirmed
  // unused by any UI consumer in the codes-view audit.
  codes: defineTable({
    specialtySlug: v.string(),
    specialty: v.optional(v.string()),
    source: v.optional(v.string()),
    code: v.string(),
    category: v.optional(v.string()),
    consolidationCategory: v.optional(v.string()),
    description: v.optional(v.string()),
    isInAMBOSS: v.optional(v.boolean()),
    articlesWhereCoverageIs: jsonBlobString,
    notes: v.optional(v.string()),
    gaps: v.optional(v.string()),
    coverageLevel: v.optional(v.string()),
    depthOfCoverage: v.optional(v.number()),
    existingArticleUpdates: jsonBlobString,
    newArticlesNeeded: jsonBlobString,
    improvements: v.optional(v.string()),
  })
    .index('by_specialty', ['specialtySlug'])
    .index('by_specialty_code', ['specialtySlug', 'code'])
    .index('by_specialty_category', ['specialtySlug', 'category']),

  codeCategories: defineTable({
    specialtySlug: v.string(),
    codeCategory: v.optional(v.string()),
    source: v.optional(v.string()),
    areAllCodesRun: v.optional(v.boolean()),
    isConsolidated: v.optional(v.boolean()),
    description: v.optional(v.string()),
    numCodes: v.optional(v.number()),
    totalArticleCodes: v.optional(v.number()),
    totalSectionCodes: v.optional(v.number()),
    codesToIgnore: v.optional(v.string()),
    numIncludedCodes: v.optional(v.number()),
    includedArticleCodes: v.optional(jsonBlob),
    numIncludedArticleCodes: v.optional(v.number()),
    excludedArticleCodes: v.optional(jsonBlob),
    numExcludedArticleCodes: v.optional(v.number()),
    includedSectionCodes: v.optional(jsonBlob),
    numIncludedSectionCodes: v.optional(v.number()),
    excludedSectionCodes: v.optional(jsonBlob),
    numExcludedSectionCodes: v.optional(v.number()),
    totallyIgnoredCodes: v.optional(jsonBlob),
    numTotallyIgnoredCodes: v.optional(v.number()),
  }).index('by_specialty', ['specialtySlug']),

  consolidatedArticles: defineTable({
    specialtySlug: v.string(),
    articleTitle: v.optional(v.string()),
    articleType: v.optional(v.string()),
    specialtyName: v.optional(v.string()),
    category: v.optional(v.string()),
    articleId: v.optional(v.string()),
    numCodes: v.optional(v.number()),
    codes: jsonBlobString,
    previousArticleTitleSuggestions: v.optional(jsonBlob),
    overallCoverage: v.optional(v.number()),
    overallImportance: v.optional(v.number()),
    justification: v.optional(v.string()),
  }).index('by_specialty', ['specialtySlug']),

  consolidatedSections: defineTable({
    specialtySlug: v.string(),
    assignedEditor: v.optional(v.string()),
    editorInTheLoopReview: v.optional(v.string()),
    articleTitle: v.optional(v.string()),
    articleType: v.optional(v.string()),
    articleId: v.optional(v.string()),
    sectionName: v.optional(v.string()),
    newSection: v.optional(v.boolean()),
    sectionUpdate: v.optional(v.boolean()),
    newPhrase: v.optional(v.string()),
    specialtyName: v.optional(v.string()),
    category: v.optional(v.string()),
    unique_title: v.optional(v.string()),
    uniqueId: v.optional(v.string()),
    numCodes: v.optional(v.number()),
    codes: jsonBlobString,
    previousSectionNames: v.optional(jsonBlob),
    exists: v.optional(v.boolean()),
    // Note: also exposed as `unique_title` (snake_case) to match the existing
    // ConsolidatedSection type — see field below.
    sectionId: v.optional(v.string()),
    overallCoverage: v.optional(v.number()),
    overallImportance: v.optional(v.number()),
    justification: v.optional(v.string()),
    isSearched: v.optional(v.boolean()),
    llmSearchTerms: v.optional(v.string()),
    verdict: v.optional(v.string()),
    justifcation: v.optional(v.string()),
    isSufficientlyCovered: v.optional(v.boolean()),
    areAllSourcesFetched: v.optional(v.boolean()),
  }).index('by_specialty', ['specialtySlug']),

  newArticleSuggestions: defineTable(articleSuggestionFields).index('by_specialty', [
    'specialtySlug',
  ]),

  articleUpdateSuggestions: defineTable(articleSuggestionFields).index('by_specialty', [
    'specialtySlug',
  ]),

  // Volatile per-run state: codes currently being processed by an active
  // map_codes workflow. Workflow inserts on start, deletes on writeMapping
  // completion (or on reset). Keeps the in-flight pulse fully reactive without
  // straddling Convex codes + Postgres pipeline state.
  mappingsInFlight: defineTable({
    specialtySlug: v.string(),
    code: v.string(),
    runId: v.string(),
    startedAt: v.number(),
  })
    .index('by_specialty', ['specialtySlug'])
    .index('by_specialty_code', ['specialtySlug', 'code'])
    .index('by_run', ['runId']),
});
