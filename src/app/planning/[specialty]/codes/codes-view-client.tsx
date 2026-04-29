'use client';

import { useQuery } from '@tanstack/react-query';
import { CodesView } from '../../_components/codes-view';
import { TableSkeleton } from '../../_components/table-skeleton';
import { fetchCodesData } from './actions';
import { codesQueryKey } from './query-keys';

export function CodesViewClient({ slug }: { slug: string }) {
  // The first navigation here gets data from the dehydrated server cache (set
  // up by `HydrationBoundary` in the page). Subsequent visits within the
  // 5-minute `staleTime` skip the round trip entirely — TanStack Query
  // returns the cached data synchronously and the table renders in the same
  // frame the user clicks the tab. After 5 min the data is considered stale
  // and refetches in the background on next mount.
  const { data, isLoading } = useQuery({
    queryKey: codesQueryKey(slug),
    queryFn: () => fetchCodesData(slug),
    // While any code is being mapped, poll every 3 s so rows pick up their
    // results as the workflow writes them through. Polling auto-stops once
    // the in-flight set comes back empty (server-driven). Replaces the
    // `router.refresh()` interval that lived inside `CodesView` — the new
    // path keeps refreshes inside the query cache instead of round-tripping
    // through the RSC layer.
    refetchInterval: (q) => {
      const inFlight = q.state.data?.inFlight ?? [];
      return inFlight.length > 0 ? 3000 : false;
    },
  });

  if (isLoading || !data) return <TableSkeleton columns={9} rows={12} />;

  return (
    <CodesView
      codes={data.codes}
      specialtySlug={slug}
      canEdit={!data.lock.locked}
      lockStatus={data.lock.status}
      inFlightCodes={data.inFlight}
    />
  );
}
