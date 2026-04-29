import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { fetchCodesData } from './actions';
import { CodesViewClient } from './codes-view-client';
import { codesQueryKey } from './query-keys';

export default async function CodesPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: slug } = await params;

  // Server-side prefetch: run the same fetch that `CodesViewClient`'s
  // `useQuery` would, then dehydrate the QueryClient state. The
  // `HydrationBoundary` ships that state to the browser so the client cache
  // is populated before the table mounts — no client-side round trip needed
  // on the first visit. Returning the `Promise` instead of awaiting lets the
  // server stream the rest of the page while the codes query runs.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: codesQueryKey(slug),
    queryFn: () => fetchCodesData(slug),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CodesViewClient slug={slug} />
    </HydrationBoundary>
  );
}
