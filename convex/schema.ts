import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Single-DB Convex setup. Holds editor-facing data, ontologies, AMBOSS
// library mirror, and pipeline state (post-Phase-3 migration). Postgres is
// no longer used.

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
  ...authTables,

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

  // --- Read-only ontologies. Replace + read pattern (refreshed via xlsx
  //     seed); UI consumes via fetchQuery in src/lib/data/sources.ts.
  icd10Codes: defineTable({
    specialtySlug: v.string(),
    codeCategory: v.optional(v.string()),
    codeCategoryDescription: v.optional(v.string()),
    icd10Code: v.optional(v.string()),
    icd10CodeDescription: v.optional(v.string()),
  }).index('by_specialty', ['specialtySlug']),

  hcupCodes: defineTable({
    specialtySlug: v.string(),
    codeCategory: v.optional(v.string()),
    codeCategoryDescription: v.optional(v.string()),
    icd10Code: v.optional(v.string()),
    icd10CodeDescription: v.optional(v.string()),
  }).index('by_specialty', ['specialtySlug']),

  abimCodes: defineTable({
    specialtySlug: v.string(),
    abimIndex: v.optional(v.string()),
    primaryCategory: v.optional(v.string()),
    secondaryCategory: v.optional(v.string()),
    tertiaryCategory: v.optional(v.string()),
    disease: v.optional(v.string()),
    specialty: v.optional(v.string()),
    code: v.optional(v.string()),
    item: v.optional(v.string()),
    choice: v.optional(v.string()),
    category: v.optional(v.string()),
    count: v.optional(v.number()),
  }).index('by_specialty', ['specialtySlug']),

  orphaCodes: defineTable({
    specialtySlug: v.string(),
    orphaCode: v.optional(v.string()),
    parentOrphaCode: v.optional(v.string()),
    specificName: v.optional(v.string()),
    parentCategory: v.optional(v.string()),
    orphaTargetFilenamesToInclude: v.optional(v.string()),
    icd10LettersToInclude: v.optional(v.string()),
    count: v.optional(v.number()),
  }).index('by_specialty', ['specialtySlug']),

  // --- AMBOSS library mirror (for in-workflow ID validation). Refreshed via
  //     scripts/refresh-amboss-library.ts from a JSON export.
  ambossArticles: defineTable({
    articleId: v.string(),
    title: v.string(),
    contentBase: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_article_id', ['articleId']),

  ambossSections: defineTable({
    sectionId: v.string(),
    articleId: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index('by_section_id', ['sectionId'])
    .index('by_article', ['articleId']),

  // Per-email OTP request counter. Written from an internal mutation called
  // by the Email provider's `sendVerificationRequest` hook before each send.
  // One row per email; the row's window resets when older than the limit
  // duration (see convex/otpRateLimit.ts). Doesn't carry an expiration —
  // entries naturally fall out of relevance once their window expires.
  otpRateLimit: defineTable({
    email: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_email', ['email']),

  // --- Source dropdowns: code + milestone source registries (small).
  codeSources: defineTable({
    slug: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index('by_slug', ['slug']),

  milestoneSources: defineTable({
    slug: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index('by_slug', ['slug']),

  // --- Pipeline state. Vercel Workflow durability is managed by the runtime;
  //     these tables are application-level state the workflow code chooses to
  //     persist (run history, stage progression, structured event log, and
  //     the staging table for codes pending approval).
  //
  // JSONB-shaped fields are stringified so unicode keys (which AMBOSS section
  // titles can contain — see schema comment at top) don't break Convex.
  pipelineRuns: defineTable({
    specialtySlug: v.string(),
    status: v.string(),
    workflowRunId: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    contentOutlineUrls: jsonBlobString,
    identifyModulesInstructions: v.optional(v.string()),
    extractCodesInstructions: v.optional(v.string()),
    milestonesInstructions: v.optional(v.string()),
    mappingInstructions: v.optional(v.string()),
    mappingCheckIds: v.boolean(),
    mappingFilter: jsonBlobString,
    // Actor audit trail. Set when a user triggers the run via an authenticated
    // request; left undefined for workflow-internal create paths and legacy
    // rows from before this field existed.
    createdByUserId: v.optional(v.id('users')),
  })
    .index('by_specialty', ['specialtySlug'])
    .index('by_specialty_started', ['specialtySlug', 'startedAt']),

  pipelineStages: defineTable({
    runId: v.string(),
    stage: v.string(),
    status: v.string(),
    workflowRunId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
    outputSummary: jsonBlobString,
    draftPayload: jsonBlobString,
    errorMessage: v.optional(v.string()),
  })
    .index('by_run', ['runId'])
    .index('by_run_stage', ['runId', 'stage']),

  pipelineEvents: defineTable({
    runId: v.string(),
    stage: v.string(),
    level: v.string(),
    message: v.string(),
    metrics: jsonBlobString,
    createdAt: v.number(),
  })
    .index('by_run', ['runId'])
    .index('by_run_stage_created', ['runId', 'stage', 'createdAt']),

  extractedCodes: defineTable({
    runId: v.string(),
    specialtySlug: v.string(),
    code: v.string(),
    category: v.optional(v.string()),
    consolidationCategory: v.optional(v.string()),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    metadata: jsonBlobString,
    createdAt: v.number(),
  })
    .index('by_run', ['runId'])
    .index('by_specialty', ['specialtySlug']),
});
