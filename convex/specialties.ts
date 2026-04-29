import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('specialties').collect();
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query('specialties')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    source: v.string(),
    sheetId: v.optional(v.string()),
    xlsxPath: v.optional(v.string()),
    region: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('specialties')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert('specialties', args);
  },
});

export const remove = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const row = await ctx.db
      .query('specialties')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

/**
 * Workflow write: stores approved milestone text + bumps the seed timestamp.
 * Replaces the Drizzle UPDATE in workflows that finalize milestone extraction.
 * Pass `milestones: undefined` to clear (used by reset-stage on
 * extract_milestones).
 */
export const updateMilestones = mutation({
  args: {
    slug: v.string(),
    milestones: v.optional(v.string()),
    bumpSeedTimestamp: v.optional(v.boolean()),
  },
  handler: async (ctx, { slug, milestones, bumpSeedTimestamp }) => {
    const row = await ctx.db
      .query('specialties')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (!row) throw new Error(`No specialty ${slug}`);
    const patch: { milestones?: string; lastSeededAt?: number } = { milestones };
    if (bumpSeedTimestamp) patch.lastSeededAt = Date.now();
    await ctx.db.patch(row._id, patch);
  },
});
