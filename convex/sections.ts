import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserOrService, serviceSecretArg } from './_lib/access';

// `codes` blob is JSON-stringified on disk (see schema.ts) and returned
// as-is — parsing happens at the boundary in `src/lib/convex-blobs.ts`.

export const listConsolidated = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('consolidatedSections')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const patch = mutation({
  args: {
    id: v.id('consolidatedSections'),
    fields: v.object({
      assignedEditor: v.optional(v.string()),
      editorInTheLoopReview: v.optional(v.string()),
      articleTitle: v.optional(v.string()),
      sectionName: v.optional(v.string()),
      newPhrase: v.optional(v.string()),
      sectionId: v.optional(v.string()),
      verdict: v.optional(v.string()),
      justification: v.optional(v.string()),
      newSection: v.optional(v.boolean()),
      sectionUpdate: v.optional(v.boolean()),
    }),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { id, fields, _secret }) => {
    await requireUserOrService(ctx, _secret);
    await ctx.db.patch(id, fields);
  },
});

export const bulkInsert = mutation({
  args: { slug: v.string(), rows: v.array(v.any()), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows) {
      await ctx.db.insert('consolidatedSections', { specialtySlug: slug, ...r });
    }
  },
});

export const deleteForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('consolidatedSections')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
