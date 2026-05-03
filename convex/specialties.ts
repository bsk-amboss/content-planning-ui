import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUser, requireUserOrService, serviceSecretArg } from './_lib/access';

export const list = query({
  args: { _secret: serviceSecretArg },
  handler: async (ctx, args) => {
    await requireUserOrService(ctx, args._secret);
    return await ctx.db.query('specialties').collect();
  },
});

export const get = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
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
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { _secret, ...args }) => {
    await requireUserOrService(ctx, _secret);
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
    await requireUser(ctx);
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
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { slug, milestones, bumpSeedTimestamp, _secret }) => {
    await requireUserOrService(ctx, _secret);
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
