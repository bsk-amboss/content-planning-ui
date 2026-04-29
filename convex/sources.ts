import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Code + milestone source dropdowns. Tiny tables, full-list queries.

export const listCode = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('codeSources').collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listMilestone = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('milestoneSources').collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createCode = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const existing = await ctx.db
      .query('codeSources')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert('codeSources', { slug, name, createdAt: Date.now() });
  },
});

export const createMilestone = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const existing = await ctx.db
      .query('milestoneSources')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert('milestoneSources', { slug, name, createdAt: Date.now() });
  },
});

export const removeCode = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const existing = await ctx.db
      .query('codeSources')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const removeMilestone = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const existing = await ctx.db
      .query('milestoneSources')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
