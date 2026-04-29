import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Local mirror of the AMBOSS library's canonical article + section IDs. Used
// by the mapping workflow to validate IDs the LLM cites without round-tripping
// the MCP server. Refreshed via scripts/refresh-amboss-library.ts from a JSON
// export. ~1.5k articles + ~15k sections.

export const listArticleIds = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('ambossArticles').collect();
    return rows.map((r) => r.articleId);
  },
});

export const listSectionIds = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('ambossSections').collect();
    return rows.map((r) => r.sectionId);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db.query('ambossArticles').collect();
    const sections = await ctx.db.query('ambossSections').collect();
    let lastSyncedAt = 0;
    for (const r of articles) if (r.updatedAt > lastSyncedAt) lastSyncedAt = r.updatedAt;
    for (const r of sections) if (r.updatedAt > lastSyncedAt) lastSyncedAt = r.updatedAt;
    return {
      articles: articles.length,
      sections: sections.length,
      lastSyncedAt: lastSyncedAt || null,
    };
  },
});

const articleRow = v.object({
  articleId: v.string(),
  title: v.string(),
  contentBase: v.optional(v.string()),
});
const sectionRow = v.object({
  sectionId: v.string(),
  articleId: v.string(),
  title: v.string(),
});

export const upsertArticles = mutation({
  args: { rows: v.array(articleRow), updatedAt: v.number() },
  handler: async (ctx, { rows, updatedAt }) => {
    for (const r of rows) {
      const existing = await ctx.db
        .query('ambossArticles')
        .withIndex('by_article_id', (q) => q.eq('articleId', r.articleId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          title: r.title,
          contentBase: r.contentBase,
          updatedAt,
        });
      } else {
        await ctx.db.insert('ambossArticles', { ...r, updatedAt });
      }
    }
  },
});

export const upsertSections = mutation({
  args: { rows: v.array(sectionRow), updatedAt: v.number() },
  handler: async (ctx, { rows, updatedAt }) => {
    for (const r of rows) {
      const existing = await ctx.db
        .query('ambossSections')
        .withIndex('by_section_id', (q) => q.eq('sectionId', r.sectionId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          articleId: r.articleId,
          title: r.title,
          updatedAt,
        });
      } else {
        await ctx.db.insert('ambossSections', { ...r, updatedAt });
      }
    }
  },
});

/**
 * Prune rows whose `updatedAt` is older than the given timestamp — used by
 * --prune mode in refresh-amboss-library after a full upsert pass to drop
 * articles/sections no longer in the export.
 */
export const pruneOlderThan = mutation({
  args: { updatedAt: v.number() },
  handler: async (ctx, { updatedAt }) => {
    let pruned = 0;
    const sections = await ctx.db.query('ambossSections').collect();
    for (const r of sections) {
      if (r.updatedAt < updatedAt) {
        await ctx.db.delete(r._id);
        pruned += 1;
      }
    }
    const articles = await ctx.db.query('ambossArticles').collect();
    for (const r of articles) {
      if (r.updatedAt < updatedAt) {
        await ctx.db.delete(r._id);
        pruned += 1;
      }
    }
    return { pruned };
  },
});
