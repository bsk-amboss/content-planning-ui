import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query('codeCategories')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const patch = mutation({
  args: {
    id: v.id('codeCategories'),
    fields: v.object({
      codeCategory: v.optional(v.string()),
      description: v.optional(v.string()),
      areAllCodesRun: v.optional(v.boolean()),
      isConsolidated: v.optional(v.boolean()),
      codesToIgnore: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, fields }) => {
    await ctx.db.patch(id, fields);
  },
});

export const bulkInsert = mutation({
  args: { slug: v.string(), rows: v.array(v.any()) },
  handler: async (ctx, { slug, rows }) => {
    for (const r of rows) {
      await ctx.db.insert('codeCategories', { specialtySlug: slug, ...r });
    }
  },
});

export const deleteForSpecialty = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const rows = await ctx.db
      .query('codeCategories')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
