import { Suspense } from 'react';
import { getOverviewCounts } from '@/lib/data/overview';
import { getSpecialty } from '@/lib/data/specialties';
import { OverviewSkeleton } from '../_components/overview-skeleton';
import { OverviewView } from '../_components/overview-view';

export default async function SpecialtyOverview({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewData slug={slug} />
    </Suspense>
  );
}

async function OverviewData({ slug }: { slug: string }) {
  const specialty = await getSpecialty(slug);
  if (!specialty) return null;

  const counts = await getOverviewCounts(slug);

  const statItems = [
    { label: 'Codes', value: counts.codes, hint: `${counts.mappedCodes} mapped` },
    { label: 'Categories', value: counts.categories },
    {
      label: 'Consolidated articles',
      value: counts.consolidatedArticles,
      hint: `${counts.newArticles} new suggestions`,
    },
    { label: 'Consolidated sections', value: counts.consolidatedSections },
  ];

  const note =
    counts.totalCodes !== undefined
      ? `Stats tab: total ${counts.totalCodes} · completed mappings ${counts.completedMappings ?? 0}.`
      : undefined;

  return <OverviewView stats={statItems} note={note} />;
}
