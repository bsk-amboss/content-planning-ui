import { Suspense } from 'react';
import { listConsolidatedSections } from '@/lib/data/sections';
import { SectionsView } from '../../_components/sections-view';

export default async function SectionsPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const rows = await listConsolidatedSections(slug);
  return (
    <Suspense fallback={null}>
      <SectionsView rows={rows} />
    </Suspense>
  );
}
