import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// Local mirror of the AMBOSS library article + section IDs, used by the
// mapping workflow to validate cited IDs without round-tripping the MCP
// server. Refreshed via scripts/refresh-amboss-library.ts.

export const ambossTables = {
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
};
