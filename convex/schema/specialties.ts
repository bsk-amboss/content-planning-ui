import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const specialtiesTables = {
  specialties: defineTable({
    slug: v.string(),
    name: v.string(),
    source: v.string(),
    sheetId: v.optional(v.string()),
    xlsxPath: v.optional(v.string()),
    lastSeededAt: v.optional(v.number()),
    milestones: v.optional(v.string()),
    region: v.optional(v.string()),
    language: v.optional(v.string()),
  }).index('by_slug', ['slug']),
};
