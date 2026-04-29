import { v } from 'convex/values';
import { query } from './_generated/server';

const COVERAGE_LEVELS = [
  'none',
  'student',
  'early-resident',
  'advanced-resident',
  'attending',
  'specialist',
] as const;

/**
 * Counts driving the specialty Overview cards. Convex doesn't have a cheap
 * `count(*) where …` for filtered queries, so we collect by index and reduce.
 * For our scale (low thousands of rows per table) this is well under the
 * per-query data-scan budget. If the codes table grows by an order of
 * magnitude we can switch to a maintained-counter pattern.
 *
 * `totalCodes` / `completedMappings` from `specialty_stats` are not in here
 * because that table stays on Postgres — the data layer (`getOverviewCounts`)
 * stitches them in.
 */
export const counts = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const [codes, categories, consolidated, newArticles, sections] = await Promise.all([
      ctx.db
        .query('codes')
        .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
        .collect(),
      ctx.db
        .query('codeCategories')
        .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
        .collect(),
      ctx.db
        .query('consolidatedArticles')
        .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
        .collect(),
      ctx.db
        .query('newArticleSuggestions')
        .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
        .collect(),
      ctx.db
        .query('consolidatedSections')
        .withIndex('by_specialty', (q) => q.eq('specialtySlug', slug))
        .collect(),
    ]);
    const allowed = new Set<string>(COVERAGE_LEVELS);
    const mappedCodes = codes.reduce(
      (n, c) => (c.coverageLevel && allowed.has(c.coverageLevel) ? n + 1 : n),
      0,
    );
    return {
      codes: codes.length,
      mappedCodes,
      categories: categories.length,
      consolidatedArticles: consolidated.length,
      newArticles: newArticles.length,
      consolidatedSections: sections.length,
    };
  },
});
