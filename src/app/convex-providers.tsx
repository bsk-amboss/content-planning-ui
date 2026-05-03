'use client';

import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs';
import { ConvexReactClient } from 'convex/react';
import { env } from '@/env';

/**
 * Wraps the app with the Convex client used by every `useQuery` /
 * `useMutation` call. Mounted at the root in `src/app/layout.tsx`.
 *
 * The client is constructed at module scope rather than inside `useState`.
 * `new ConvexReactClient()` calls `Math.random()` to mint a connection id;
 * Next 16's `cacheComponents` static prerender refuses any non-deterministic
 * call inside a render unless it sits behind a Suspense boundary, so keeping
 * the construction out of the render tree avoids the prerender error
 * entirely. One module-scope client is the right fit anyway — every browser
 * tab has its own JS environment, so there's no cross-request leakage.
 */
const convex = new ConvexReactClient(
  env.NEXT_PUBLIC_CONVEX_URL ?? 'https://example.convex.cloud',
);

export function ConvexProviders({ children }: { children: React.ReactNode }) {
  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
