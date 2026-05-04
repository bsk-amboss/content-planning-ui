import { defineTable } from 'convex/server';
import { v } from 'convex/values';
import { jsonBlob } from './_shared';

export const sectionsTables = {
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
    codes: v.optional(v.array(v.any())),
    previousSectionNames: v.optional(jsonBlob),
    exists: v.optional(v.boolean()),
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
};
