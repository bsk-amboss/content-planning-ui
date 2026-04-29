/**
 * One-shot production wipe. Clears every Convex table and the remaining
 * Postgres tables (pipeline state + specialties).
 *
 * After Phase 2 of the migration, ontology + AMBOSS + sources live in Convex
 * (handled per-specialty + globally below). Only pipeline_runs / pipeline_
 * stages / pipeline_events / extracted_codes + specialties remain on Postgres
 * (Phase 3 moves those too).
 *
 * Usage:
 *   pnpm dotenv -e .env.production.local -- tsx scripts/wipe-prod.ts
 */
import { ConvexHttpClient } from 'convex/browser';
import { env } from '@/env';
import { getDb } from '@/lib/db';
import {
  extractedCodes,
  pipelineEvents,
  pipelineRuns,
  pipelineStages,
  specialties,
} from '@/lib/db/schema';
import { api } from '../convex/_generated/api';

async function main() {
  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL not set');
  }
  const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  const db = getDb();

  console.log('▶ wiping Convex …');
  const convexSpecialties = (await convex.query(api.specialties.list)) as Array<{
    slug: string;
  }>;
  console.log(`  ${convexSpecialties.length} specialty rows in Convex`);
  for (const s of convexSpecialties) {
    const slug = s.slug;
    await Promise.all([
      convex.mutation(api.codes.deleteForSpecialty, { slug }),
      convex.mutation(api.categories.deleteForSpecialty, { slug }),
      convex.mutation(api.articles.deleteConsolidatedForSpecialty, { slug }),
      convex.mutation(api.articles.deleteNewForSpecialty, { slug }),
      convex.mutation(api.articles.deleteUpdatesForSpecialty, { slug }),
      convex.mutation(api.sections.deleteForSpecialty, { slug }),
      convex.mutation(api.ontology.clearIcd10ForSpecialty, { slug }),
      convex.mutation(api.ontology.clearHcupForSpecialty, { slug }),
      convex.mutation(api.ontology.clearAbimForSpecialty, { slug }),
      convex.mutation(api.ontology.clearOrphaForSpecialty, { slug }),
    ]);
    await convex.mutation(api.specialties.remove, { slug });
    console.log(`  ✓ ${slug}`);
  }
  // Global tables (no per-specialty key): wipe via raw SQL-like Convex calls.
  // Sources + AMBOSS aren't huge — just iterate and delete.
  for (const r of await convex.query(api.sources.listCode)) {
    await convex.mutation(api.sources.removeCode, { slug: r.slug });
  }
  for (const r of await convex.query(api.sources.listMilestone)) {
    await convex.mutation(api.sources.removeMilestone, { slug: r.slug });
  }
  await convex.mutation(api.amboss.pruneOlderThan, {
    updatedAt: Number.MAX_SAFE_INTEGER,
  });
  console.log('  ✓ sources + amboss cleared');

  console.log('▶ wiping Postgres …');
  // Children first because of FKs.
  await db.delete(pipelineEvents);
  await db.delete(pipelineStages);
  await db.delete(extractedCodes);
  await db.delete(pipelineRuns);
  await db.delete(specialties);
  console.log('  ✓ pipeline + specialties cleared');

  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
