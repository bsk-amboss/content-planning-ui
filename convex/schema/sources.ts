import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// Source dropdowns: code + milestone source registries (small).

export const sourcesTables = {
  codeSources: defineTable({
    slug: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index('by_slug', ['slug']),

  milestoneSources: defineTable({
    slug: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index('by_slug', ['slug']),
};
