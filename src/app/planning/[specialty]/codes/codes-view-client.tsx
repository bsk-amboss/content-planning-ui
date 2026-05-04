'use client';

import { type Preloaded, usePreloadedQuery } from 'convex/react';
import type { Code } from '@/lib/types';
import type { api } from '../../../../../convex/_generated/api';
import { CodesView } from '../../_components/codes-view';

/**
 * Codes are served by Convex — every connected client re-renders when any
 * row in the specialty changes (workflow writes, user edits, in-flight pulse
 * inserts/deletes). The page renders a `Preloaded` query so the first paint
 * has the full table; subsequent updates flow over the open WebSocket.
 *
 * The blob fields (`articlesWhereCoverageIs` / `existingArticleUpdates` /
 * `newArticlesNeeded`) are now stored as typed arrays in Convex (Phase B2),
 * so no client-side hydration is needed.
 */
export function CodesViewClient({
  slug,
  canEdit,
  lockStatus,
  preloadedCodes,
  preloadedInFlight,
}: {
  slug: string;
  canEdit: boolean;
  lockStatus: string | null;
  preloadedCodes: Preloaded<typeof api.codes.list>;
  preloadedInFlight: Preloaded<typeof api.codes.inFlight>;
}) {
  const codes = usePreloadedQuery(preloadedCodes);
  const inFlight = usePreloadedQuery(preloadedInFlight);

  return (
    <CodesView
      codes={codes as unknown as Code[]}
      specialtySlug={slug}
      canEdit={canEdit}
      lockStatus={lockStatus}
      inFlightCodes={inFlight}
    />
  );
}
