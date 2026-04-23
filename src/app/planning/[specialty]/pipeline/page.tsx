import { Suspense } from 'react';
import { getAmbossLibraryStats } from '@/lib/data/amboss-library';
import { listCodeSources } from '@/lib/data/code-sources';
import {
  listCodeCategories,
  listUnmappedCodeCount,
  listUnmappedCodesForPicker,
} from '@/lib/data/codes';
import { listMilestoneSources } from '@/lib/data/milestone-sources';
import { getCurrentPipelineRun, getLatestStageContexts } from '@/lib/data/pipeline';
import { getSpecialty } from '@/lib/data/specialties';
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

function deriveContentBase(region: string | undefined | null): string {
  if (region === 'us') return 'US';
  if (region === 'de') return 'German';
  return 'US';
}

async function PipelineData({ slug }: { slug: string }) {
  // Each stage's latest state comes from its own run, so a milestones-only run
  // doesn't wipe the codes card back to "pending."
  const [
    run,
    sources,
    milestoneSources,
    stageCtxs,
    unmappedCodeCount,
    libraryStats,
    specialty,
    codeCategories,
    unmappedCodePicker,
  ] = await Promise.all([
    getCurrentPipelineRun(slug),
    listCodeSources(),
    listMilestoneSources(),
    getLatestStageContexts(slug),
    listUnmappedCodeCount(slug),
    getAmbossLibraryStats(),
    getSpecialty(slug),
    listCodeCategories(slug),
    listUnmappedCodesForPicker(slug),
  ]);

  const stages = {
    extract_codes: stageCtxs.extract_codes ?? null,
    extract_milestones: stageCtxs.extract_milestones ?? null,
    map_codes: stageCtxs.map_codes ?? null,
    consolidate_primary: stageCtxs.consolidate_primary ?? null,
    consolidate_articles: stageCtxs.consolidate_articles ?? null,
    consolidate_sections: stageCtxs.consolidate_sections ?? null,
  };

  // Specialty type from the repository layer doesn't expose `region`; read
  // directly from the underlying row via the getSpecialty-adjacent helper
  // once we've confirmed the record exists. For now, default to US.
  const defaultContentBase = deriveContentBase(
    (specialty as { region?: string | null } | null)?.region,
  );

  return (
    <PipelineDashboard
      specialtySlug={slug}
      run={run}
      sources={sources.map((s) => ({ slug: s.slug, name: s.name }))}
      milestoneSources={milestoneSources.map((s) => ({ slug: s.slug, name: s.name }))}
      stages={stages}
      unmappedCodeCount={unmappedCodeCount}
      defaultContentBase={defaultContentBase}
      libraryStats={libraryStats}
      codeCategories={codeCategories}
      unmappedCodePicker={unmappedCodePicker}
    />
  );
}
