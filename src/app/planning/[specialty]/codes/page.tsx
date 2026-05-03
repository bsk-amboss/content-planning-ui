import { preloadQueryAsUser } from '@/lib/convex/server';
import { getConsolidationLockState } from '@/lib/data/codes';
import { api } from '../../../../../convex/_generated/api';
import { CodesViewClient } from './codes-view-client';

export default async function CodesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;

  // Codes + in-flight markers come from Convex; the consolidation lock still
  // lives in Postgres pipeline state. Preload all three in parallel so the
  // first render has every prop ready and the client doesn't wait on a
  // round trip.
  const [lock, preloadedCodes, preloadedInFlight] = await Promise.all([
    getConsolidationLockState(slug),
    preloadQueryAsUser(api.codes.list, { slug }),
    preloadQueryAsUser(api.codes.inFlight, { slug }),
  ]);

  return (
    <CodesViewClient
      slug={slug}
      canEdit={!lock.locked}
      lockStatus={lock.status}
      preloadedCodes={preloadedCodes}
      preloadedInFlight={preloadedInFlight}
    />
  );
}
