/**
 * One-shot production wipe. Clears every Convex table.
 *
 * Single-DB Convex setup: all editor data, ontology, AMBOSS library mirror,
 * sources, and pipeline state live here.
 *
 * Usage:
 *   pnpm dotenv -e .env.production.local -- tsx scripts/wipe-prod.ts
 */
import { api } from '../convex/_generated/api';
import { convexClient } from './_lib/convex';

async function main() {
  const convex = convexClient();

  console.log('▶ wiping per-specialty Convex tables …');
  const convexSpecialties = (await convex.query(api.specialties.list)) as Array<{
    slug: string;
  }>;
  console.log(`  ${convexSpecialties.length} specialty rows`);
  for (const s of convexSpecialties) {
    const slug = s.slug;
    // Cancel runs first so resetStage cascades cleanly.
    await convex.mutation(api.pipeline.cancelStaleRunsForSpecialty, { slug });
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
    // Iterate runs to drop their stages + events + extracted_codes.
    const runs = await convex.query(api.pipeline.listRuns, { slug });
    for (const r of runs) {
      const stages = await convex.query(api.pipeline.listStages, { runId: r._id });
      for (const st of stages) {
        await convex.mutation(api.pipeline.resetStage, {
          runId: r._id,
          stage: st.stage,
        });
      }
    }
    await convex.mutation(api.specialties.remove, { slug });
    console.log(`  ✓ ${slug}`);
  }

  console.log('▶ wiping global Convex tables …');
  for (const r of await convex.query(api.sources.listCode)) {
    await convex.mutation(api.sources.removeCode, { slug: r.slug });
  }
  for (const r of await convex.query(api.sources.listMilestone)) {
    await convex.mutation(api.sources.removeMilestone, { slug: r.slug });
  }
  await convex.mutation(api.amboss.pruneOlderThan, {
    updatedAt: Number.MAX_SAFE_INTEGER,
  });
  console.log('  ✓ sources + amboss + pipelines cleared');

  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
