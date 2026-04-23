import { Suspense } from 'react';
import { listCodeSources } from '@/lib/data/code-sources';
import { listMilestoneSources } from '@/lib/data/milestone-sources';
import { getCurrentPipelineRun, getLatestStageContexts } from '@/lib/data/pipeline';
import { PipelineDashboard } from './_components/pipeline-dashboard';

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  return (
    <Suspense fallback={null}>
      <PipelineData slug={slug} />
    </Suspense>
  );
}

async function PipelineData({ slug }: { slug: string }) {
  // Each stage's latest state comes from its own run, so a milestones-only run
  // doesn't wipe the codes card back to "pending."
  const [run, sources, milestoneSources, stageCtxs] = await Promise.all([
    getCurrentPipelineRun(slug),
    listCodeSources(),
    listMilestoneSources(),
    getLatestStageContexts(slug),
  ]);

  const stages = {
    extract_codes: stageCtxs.extract_codes ?? null,
    extract_milestones: stageCtxs.extract_milestones ?? null,
    map_codes: stageCtxs.map_codes ?? null,
    consolidate_primary: stageCtxs.consolidate_primary ?? null,
    consolidate_articles: stageCtxs.consolidate_articles ?? null,
    consolidate_sections: stageCtxs.consolidate_sections ?? null,
  };

  return (
    <PipelineDashboard
      specialtySlug={slug}
      run={run}
      sources={sources.map((s) => ({ slug: s.slug, name: s.name }))}
      milestoneSources={milestoneSources.map((s) => ({ slug: s.slug, name: s.name }))}
      stages={stages}
    />
  );
}
