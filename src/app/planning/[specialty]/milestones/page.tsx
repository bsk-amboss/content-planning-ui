import { Suspense } from 'react';
import { getMilestones } from '@/lib/data/specialties';
import { MilestonesView } from '../../_components/milestones-view';

export default async function MilestonesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const milestones = await getMilestones(slug);
  return (
    <Suspense fallback={null}>
      <MilestonesView milestones={milestones} />
    </Suspense>
  );
}
