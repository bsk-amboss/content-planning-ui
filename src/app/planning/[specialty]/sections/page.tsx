import { Suspense } from 'react';
import { listConsolidatedSections } from '@/lib/data/sections';
import { SectionsView } from '../../_components/sections-view';
import { TableSkeleton } from '../../_components/table-skeleton';

export default async function SectionsPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  return (
    <Suspense fallback={<TableSkeleton columns={7} rows={10} />}>
      <SectionsData slug={slug} />
    </Suspense>
  );
}

async function SectionsData({ slug }: { slug: string }) {
  const rows = await listConsolidatedSections(slug);
  return <SectionsView rows={rows} />;
}
