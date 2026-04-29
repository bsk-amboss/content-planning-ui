'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Once a query has been fetched, treat it as "fresh" for 5 minutes —
            // navigating back to the same tab in this window won't trigger a
            // refetch, the cached data renders instantly. After 5 minutes the
            // query goes stale and refetches on next mount/access.
            staleTime: 5 * 60 * 1000,
            // Refetching on every window focus produced surprising reloads in
            // an internal tool — disable it; the user can always reload the
            // tab manually.
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
