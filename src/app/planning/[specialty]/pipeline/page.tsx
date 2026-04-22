import { Suspense } from 'react';
import {
  getCurrentPipelineRun,
  listPipelineEvents,
  listPipelineStages,
  type PipelineStageRow,
} from '@/lib/data/pipeline';
import { PipelineDashboard } from './_components/pipeline-dashboard';

type StageName = PipelineStageRow['stage'];

function pickStage(stages: PipelineStageRow[], name: StageName): PipelineStageRow | null {
  return stages.find((s) => s.stage === name) ?? null;
}

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
  const run = await getCurrentPipelineRun(slug);
  const [stages, events] = run
    ? await Promise.all([
        listPipelineStages(run.id, slug),
        listPipelineEvents(run.id, slug),
      ])
    : [[], []];

  return (
    <PipelineDashboard
      specialtySlug={slug}
      run={run}
      events={events}
      stages={{
        extract_codes: pickStage(stages, 'extract_codes'),
        extract_milestones: pickStage(stages, 'extract_milestones'),
        map_codes: pickStage(stages, 'map_codes'),
        consolidate_primary: pickStage(stages, 'consolidate_primary'),
        consolidate_articles: pickStage(stages, 'consolidate_articles'),
        consolidate_sections: pickStage(stages, 'consolidate_sections'),
      }}
    />
  );
}
