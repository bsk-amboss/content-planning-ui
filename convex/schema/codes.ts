import { defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  coveredSectionShape,
  jsonBlob,
  newArticleShape,
  sectionUpdateShape,
} from './_shared';

export const codesTables = {
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
    articlesWhereCoverageIs: v.optional(v.array(coveredSectionShape)),
    notes: v.optional(v.string()),
    gaps: v.optional(v.string()),
    coverageLevel: v.optional(v.string()),
    depthOfCoverage: v.optional(v.number()),
    existingArticleUpdates: v.optional(v.array(sectionUpdateShape)),
    newArticlesNeeded: v.optional(v.array(newArticleShape)),
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
};
