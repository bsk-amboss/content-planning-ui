import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserOrService, serviceSecretArg } from './_lib/access';

// Read-only ontology tables (ICD-10 / HCUP / ABIM / Orpha). Per-specialty
// indexes; UI reads everything for a given specialty in one call. Refresh
// pattern from seed scripts: clearForSpecialty → bulkInsert in chunks
// (~5k rows for ICD-10, well above Convex per-mutation limits).

const icdRow = v.object({
  codeCategory: v.optional(v.string()),
  codeCategoryDescription: v.optional(v.string()),
  icd10Code: v.optional(v.string()),
  icd10CodeDescription: v.optional(v.string()),
});

const abimRow = v.object({
  abimIndex: v.optional(v.string()),
  primaryCategory: v.optional(v.string()),
  secondaryCategory: v.optional(v.string()),
  tertiaryCategory: v.optional(v.string()),
  disease: v.optional(v.string()),
  specialty: v.optional(v.string()),
  code: v.optional(v.string()),
  item: v.optional(v.string()),
  choice: v.optional(v.string()),
  category: v.optional(v.string()),
  count: v.optional(v.number()),
});

const orphaRow = v.object({
  orphaCode: v.optional(v.string()),
  parentOrphaCode: v.optional(v.string()),
  specificName: v.optional(v.string()),
  parentCategory: v.optional(v.string()),
  orphaTargetFilenamesToInclude: v.optional(v.string()),
  icd10LettersToInclude: v.optional(v.string()),
  count: v.optional(v.number()),
});

export const listIcd10 = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('icd10Codes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const listHcup = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('hcupCodes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const listAbim = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('abimCodes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const listOrpha = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('orphaCodes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

export const clearIcd10ForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('icd10Codes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

export const clearHcupForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('hcupCodes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

export const clearAbimForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('abimCodes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

export const clearOrphaForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('orphaCodes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

export const bulkInsertIcd10 = mutation({
  args: { slug: v.string(), rows: v.array(icdRow), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows)
      await ctx.db.insert('icd10Codes', { specialtySlug: slug, ...r });
  },
});

export const bulkInsertHcup = mutation({
  args: { slug: v.string(), rows: v.array(icdRow), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows) await ctx.db.insert('hcupCodes', { specialtySlug: slug, ...r });
  },
});

export const bulkInsertAbim = mutation({
  args: { slug: v.string(), rows: v.array(abimRow), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows) await ctx.db.insert('abimCodes', { specialtySlug: slug, ...r });
  },
});

export const bulkInsertOrpha = mutation({
  args: { slug: v.string(), rows: v.array(orphaRow), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows)
      await ctx.db.insert('orphaCodes', { specialtySlug: slug, ...r });
  },
});
