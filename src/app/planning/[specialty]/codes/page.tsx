import { Suspense } from 'react';
import { listCodes } from '@/lib/data/codes';
import { CodesView } from '../../_components/codes-view';

export default async function CodesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const codes = await listCodes(slug);
  return (
    <Suspense fallback={null}>
      <CodesView codes={codes} />
    </Suspense>
  );
}
