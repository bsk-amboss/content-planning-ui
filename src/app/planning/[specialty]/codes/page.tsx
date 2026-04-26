import { Suspense } from 'react';
import {
  getConsolidationLockState,
  listCodes,
  listInFlightMappings,
} from '@/lib/data/codes';
import { CodesView } from '../../_components/codes-view';

export default async function CodesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;
  const [codes, lock, inFlight] = await Promise.all([
    listCodes(slug),
    getConsolidationLockState(slug),
    listInFlightMappings(slug),
  ]);
  return (
    <Suspense fallback={null}>
      <CodesView
        codes={codes}
        specialtySlug={slug}
        canEdit={!lock.locked}
        lockStatus={lock.status}
        inFlightCodes={inFlight}
      />
    </Suspense>
  );
}
