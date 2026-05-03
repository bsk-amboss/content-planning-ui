import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserOrService, serviceSecretArg } from './_lib/access';

// All three tables (consolidatedArticles, newArticleSuggestions,
// articleUpdateSuggestions) share the same access shape: list-by-specialty,
// per-row patch, bulk insert from workflows, cascade delete on reset.
//
// The `codes` blob is JSON-stringified on disk (see schema.ts) and returned
// to consumers as a string — parsing happens at the boundary in
// `src/lib/convex-blobs.ts` to avoid Convex's ASCII-only field-name
// restriction tripping on unicode keys inside the array-of-records shape.

// --- consolidatedArticles ---------------------------------------------------

export const listConsolidated = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('consolidatedArticles')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const patchConsolidated = mutation({
  args: {
    id: v.id('consolidatedArticles'),
    fields: v.object({
      articleTitle: v.optional(v.string()),
      articleType: v.optional(v.string()),
      category: v.optional(v.string()),
      articleId: v.optional(v.string()),
      justification: v.optional(v.string()),
      overallCoverage: v.optional(v.number()),
      overallImportance: v.optional(v.number()),
    }),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { id, fields, _secret }) => {
    await requireUserOrService(ctx, _secret);
    await ctx.db.patch(id, fields);
  },
});

export const bulkInsertConsolidated = mutation({
  args: { slug: v.string(), rows: v.array(v.any()), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows) {
      await ctx.db.insert('consolidatedArticles', { specialtySlug: slug, ...r });
    }
  },
});

export const deleteConsolidatedForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('consolidatedArticles')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

// --- newArticleSuggestions --------------------------------------------------

export const listNew = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('newArticleSuggestions')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const patchNew = mutation({
  args: {
    id: v.id('newArticleSuggestions'),
    fields: v.object({
      assignedEditor: v.optional(v.string()),
      editorInTheLoopReview: v.optional(v.string()),
      articleTitle: v.optional(v.string()),
      alternateTitles: v.optional(v.string()),
      articleProgress: v.optional(v.string()),
      articleType: v.optional(v.string()),
      articleId: v.optional(v.string()),
      verdict: v.optional(v.string()),
      justification: v.optional(v.string()),
    }),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { id, fields, _secret }) => {
    await requireUserOrService(ctx, _secret);
    await ctx.db.patch(id, fields);
  },
});

export const bulkInsertNew = mutation({
  args: { slug: v.string(), rows: v.array(v.any()), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows) {
      await ctx.db.insert('newArticleSuggestions', { specialtySlug: slug, ...r });
    }
  },
});

export const deleteNewForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('newArticleSuggestions')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

// --- articleUpdateSuggestions -----------------------------------------------

export const listUpdates = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('articleUpdateSuggestions')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const patchUpdate = mutation({
  args: {
    id: v.id('articleUpdateSuggestions'),
    fields: v.object({
      assignedEditor: v.optional(v.string()),
      editorInTheLoopReview: v.optional(v.string()),
      articleTitle: v.optional(v.string()),
      articleProgress: v.optional(v.string()),
      verdict: v.optional(v.string()),
      justification: v.optional(v.string()),
    }),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { id, fields, _secret }) => {
    await requireUserOrService(ctx, _secret);
    await ctx.db.patch(id, fields);
  },
});

export const bulkInsertUpdates = mutation({
  args: { slug: v.string(), rows: v.array(v.any()), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows) {
      await ctx.db.insert('articleUpdateSuggestions', { specialtySlug: slug, ...r });
    }
  },
});

export const deleteUpdatesForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('articleUpdateSuggestions')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
