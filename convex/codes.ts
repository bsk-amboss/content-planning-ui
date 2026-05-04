import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserOrService, serviceSecretArg } from './_lib/access';
import {
  coveredSectionShape,
  newArticleShape,
  sectionUpdateShape,
} from './schema/_shared';

/**
 * Read every code for a specialty. Replaces the Drizzle `listCodes` path —
 * `useQuery(api.codes.list, { slug })` re-renders for every connected client
 * whenever any code in the specialty is inserted, updated, or deleted.
 */
export const list = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('codes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
  },
});

/**
 * Read one code. Used by the detail modal so it can fetch on click rather
 * than relying on the list payload.
 */
export const get = query({
  args: { slug: v.string(), code: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, code, _secret }) => {
    await requireUserOrService(ctx, _secret);
    return await ctx.db
      .query('codes')
      .withIndex('by_specialty_code', (q) => q.eq('specialtySlug', slug).eq('code', code))
      .unique();
  },
});

/**
 * Codes whose mapping is currently being processed by an active map_codes
 * workflow. Returns just the code IDs — the UI uses them to flag rows with the
 * MappingPulse indicator. Auto-reactive: workflow markInFlight/clearInFlight
 * mutations cause this query to re-fire on every connected client.
 */
export const inFlight = query({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('mappingsInFlight')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    return rows.map((r) => r.code);
  },
});

/**
 * Workflow read: every code for a specialty whose `isInAMBOSS` is unset,
 * optionally narrowed by category or by exact code. Replaces the Drizzle
 * `listUnmappedCodes` step. Returns the lean shape the mapping workflow
 * needs (no blobs).
 */
export const listUnmapped = query({
  args: {
    slug: v.string(),
    categories: v.optional(v.array(v.string())),
    codes: v.optional(v.array(v.string())),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { slug, categories, codes, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('codes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    const catSet = categories?.length ? new Set(categories) : null;
    const codeSet = codes?.length ? new Set(codes) : null;
    return rows
      .filter((r) => r.isInAMBOSS === undefined)
      .filter((r) => {
        if (!catSet && !codeSet) return true;
        if (catSet && r.category && catSet.has(r.category)) return true;
        if (codeSet?.has(r.code)) return true;
        return false;
      })
      .map((r) => ({
        code: r.code,
        category: r.category ?? null,
        description: r.description ?? null,
      }));
  },
});

/**
 * User-driven edit from the detail modal. Restricted to fields the UI today
 * exposes (description, category, consolidationCategory) — workflow output
 * fields like coverageLevel/isInAmboss go through `writeMapping`.
 */
export const patch = mutation({
  args: {
    slug: v.string(),
    code: v.string(),
    fields: v.object({
      description: v.optional(v.string()),
      category: v.optional(v.string()),
      consolidationCategory: v.optional(v.string()),
    }),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { slug, code, fields, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const row = await ctx.db
      .query('codes')
      .withIndex('by_specialty_code', (q) => q.eq('specialtySlug', slug).eq('code', code))
      .unique();
    if (!row) throw new Error(`No code ${code} for specialty ${slug}`);
    await ctx.db.patch(row._id, fields);
  },
});

/**
 * Workflow write: result of one mapping pass for a single code. Replaces the
 * Drizzle `writeCodeMapping` helper. Called from the Vercel Workflow runner
 * via ConvexHttpClient.
 */
export const writeMapping = mutation({
  args: {
    slug: v.string(),
    code: v.string(),
    isInAMBOSS: v.optional(v.boolean()),
    coverageLevel: v.optional(v.string()),
    depthOfCoverage: v.optional(v.number()),
    notes: v.optional(v.string()),
    gaps: v.optional(v.string()),
    improvements: v.optional(v.string()),
    articlesWhereCoverageIs: v.optional(v.array(coveredSectionShape)),
    existingArticleUpdates: v.optional(v.array(sectionUpdateShape)),
    newArticlesNeeded: v.optional(v.array(newArticleShape)),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { slug, code, _secret, ...mapping }) => {
    await requireUserOrService(ctx, _secret);
    const row = await ctx.db
      .query('codes')
      .withIndex('by_specialty_code', (q) => q.eq('specialtySlug', slug).eq('code', code))
      .unique();
    if (!row) throw new Error(`No code ${code} for specialty ${slug}`);
    await ctx.db.patch(row._id, mapping);
    // Clear any in-flight marker for this code in one transaction so the
    // pulse drops at the same moment the mapping fields appear.
    const flight = await ctx.db
      .query('mappingsInFlight')
      .withIndex('by_specialty_code', (q) => q.eq('specialtySlug', slug).eq('code', code))
      .collect();
    for (const f of flight) await ctx.db.delete(f._id);
  },
});

/**
 * Workflow write: bulk clear mapping fields across every code in a specialty
 * (used by `resetStageCascade` for the `map_codes` stage). Skips rows that
 * are already unmapped. Also drops any in-flight markers for the specialty.
 */
export const clearAllMappingsForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('codes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const r of rows) {
      if (r.isInAMBOSS === undefined && r.coverageLevel === undefined) continue;
      await ctx.db.patch(r._id, {
        isInAMBOSS: undefined,
        coverageLevel: undefined,
        depthOfCoverage: undefined,
        notes: undefined,
        gaps: undefined,
        improvements: undefined,
        articlesWhereCoverageIs: undefined,
        existingArticleUpdates: undefined,
        newArticlesNeeded: undefined,
      });
    }
    const flights = await ctx.db
      .query('mappingsInFlight')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const f of flights) await ctx.db.delete(f._id);
  },
});

/**
 * Workflow write: clear the mapping fields on a code (used by remap-code so
 * the row goes back to "unmapped" state before re-running the mapping
 * workflow).
 */
export const clearMapping = mutation({
  args: { slug: v.string(), code: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, code, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const row = await ctx.db
      .query('codes')
      .withIndex('by_specialty_code', (q) => q.eq('specialtySlug', slug).eq('code', code))
      .unique();
    if (!row) return;
    await ctx.db.patch(row._id, {
      isInAMBOSS: undefined,
      coverageLevel: undefined,
      depthOfCoverage: undefined,
      notes: undefined,
      gaps: undefined,
      improvements: undefined,
      articlesWhereCoverageIs: undefined,
      existingArticleUpdates: undefined,
      newArticlesNeeded: undefined,
    });
  },
});

/**
 * Workflow + seed write: bulk insert. `promoteExtractedCodesToCodes` passes
 * the basic shape (code/category/description/source); the seed script passes
 * every column. The Convex schema validates the row on insert — `v.any()`
 * here just keeps the mutation surface flexible for both callers. Caller is
 * expected to have cleared the specialty first (see deleteForSpecialty).
 */
export const bulkInsert = mutation({
  args: { slug: v.string(), rows: v.array(v.any()), _secret: serviceSecretArg },
  handler: async (ctx, { slug, rows, _secret }) => {
    await requireUserOrService(ctx, _secret);
    for (const r of rows) {
      await ctx.db.insert('codes', { specialtySlug: slug, ...r });
    }
  },
});

/**
 * Workflow write: cascading delete invoked by `resetStageCascade` when an
 * editor resets the extract_codes stage. Drops every code row for the
 * specialty along with any in-flight markers.
 */
export const deleteForSpecialty = mutation({
  args: { slug: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { slug, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const codes = await ctx.db
      .query('codes')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const c of codes) await ctx.db.delete(c._id);
    const flights = await ctx.db
      .query('mappingsInFlight')
      .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
      .collect();
    for (const f of flights) await ctx.db.delete(f._id);
  },
});

/**
 * Workflow write: mark a batch of codes as in-flight when a map_codes run
 * starts processing them. Pairs with `clearMapping`/`writeMapping` which
 * both clear the marker.
 */
export const markInFlight = mutation({
  args: {
    slug: v.string(),
    codes: v.array(v.string()),
    runId: v.string(),
    _secret: serviceSecretArg,
  },
  handler: async (ctx, { slug, codes, runId, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const startedAt = Date.now();
    for (const code of codes) {
      await ctx.db.insert('mappingsInFlight', {
        specialtySlug: slug,
        code,
        runId,
        startedAt,
      });
    }
  },
});

/**
 * Workflow write: clear all in-flight markers for a given run (used on run
 * completion, failure, or cancellation). Per-code clearing happens inline in
 * `writeMapping`.
 */
export const clearInFlightForRun = mutation({
  args: { runId: v.string(), _secret: serviceSecretArg },
  handler: async (ctx, { runId, _secret }) => {
    await requireUserOrService(ctx, _secret);
    const rows = await ctx.db
      .query('mappingsInFlight')
      .withIndex('by_run', (q) => q.eq('runId', runId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
