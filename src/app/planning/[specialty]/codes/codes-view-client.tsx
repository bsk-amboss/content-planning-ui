'use client';

import { type Preloaded, usePreloadedQuery } from 'convex/react';
import { useMemo } from 'react';
import { hydrateCodes } from '@/lib/convex-blobs';
import type { Code } from '@/lib/repositories/types';
import type { api } from '../../../../../convex/_generated/api';
import { CodesView } from '../../_components/codes-view';

/**
 * Codes are now served by Convex — every connected client re-renders when any
 * row in the specialty changes (workflow writes, user edits, in-flight pulse
 * inserts/deletes). The page renders a `Preloaded` query so the first paint
 * has the full table; subsequent updates flow over the open WebSocket.
 *
 * The blob fields (`articlesWhereCoverageIs` / `existingArticleUpdates` /
 * `newArticlesNeeded`) ride the wire as JSON-stringified strings — see
 * `src/lib/convex-blobs.ts` for the why. `hydrateCodes` parses them back
 * into the legacy `Code` shape the table + modal expect. `useMemo` keeps
 * the rehydration cost off the live-update hot path; the rows array
 * identity only changes when Convex actually pushes new data.
 *
 * The consolidation lock still reads pipeline state from Postgres and is
 * passed in as a prop — workflow durability stays on Postgres per the
 * migration plan.
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
  const hydrated = useMemo(() => hydrateCodes(codes) as unknown as Code[], [codes]);

  return (
    <CodesView
      codes={hydrated}
      specialtySlug={slug}
      canEdit={canEdit}
      lockStatus={lockStatus}
      inFlightCodes={inFlight}
    />
  );
}
