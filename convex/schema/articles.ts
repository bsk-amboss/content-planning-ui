import { defineTable } from 'convex/server';
import { v } from 'convex/values';
import { articleSuggestionFields, jsonBlob } from './_shared';

export const articlesTables = {
  consolidatedArticles: defineTable({
    specialtySlug: v.string(),
    articleTitle: v.optional(v.string()),
    articleType: v.optional(v.string()),
    specialtyName: v.optional(v.string()),
    category: v.optional(v.string()),
    articleId: v.optional(v.string()),
    numCodes: v.optional(v.number()),
    codes: v.optional(v.array(v.any())),
    previousArticleTitleSuggestions: v.optional(jsonBlob),
    overallCoverage: v.optional(v.number()),
    overallImportance: v.optional(v.number()),
    justification: v.optional(v.string()),
  }).index('by_specialty', ['specialtySlug']),

  newArticleSuggestions: defineTable(articleSuggestionFields).index('by_specialty', [
    'specialtySlug',
  ]),

  articleUpdateSuggestions: defineTable(articleSuggestionFields).index('by_specialty', [
    'specialtySlug',
  ]),
};
