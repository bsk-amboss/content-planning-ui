/**
 * One-shot production wipe. Clears every editor-facing Convex table and the
 * pipeline + legacy editor tables on Postgres for every specialty present.
 *
 * Leaves intact:
 *  - Convex: nothing else exists today
 *  - Postgres: the read-only ontology (`icd10`, `hcup`, `abim`, `orpha`) and
 *    the AMBOSS library mirror (`amboss_articles`, `amboss_sections`).
 *
 * Usage:
 *   pnpm dotenv -e .env.production.local -- tsx scripts/wipe-prod.ts
 */
import { ConvexHttpClient } from 'convex/browser';
import { env } from '@/env';
import { getDb } from '@/lib/db';
import {
  abimCodes,
  codeSources,
  extractedCodes,
  hcupCodes,
  icd10Codes,
  milestoneSources,
  orphaCodes,
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
    ]);
    await convex.mutation(api.specialties.remove, { slug });
    console.log(`  ✓ ${slug}`);
  }

  console.log('▶ wiping Postgres …');
  // Pipeline state + ontology + sources still live on Postgres in this phase.
  // Order matters: child tables first because of FKs.
  await db.delete(pipelineEvents);
  await db.delete(pipelineStages);
  await db.delete(extractedCodes);
  await db.delete(pipelineRuns);
  await db.delete(icd10Codes);
  await db.delete(hcupCodes);
  await db.delete(abimCodes);
  await db.delete(orphaCodes);
  await db.delete(codeSources);
  await db.delete(milestoneSources);
  await db.delete(specialties);
  console.log('  ✓ pipeline + ontology + sources cleared');

  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
