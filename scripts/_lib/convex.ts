/**
 * Shared Convex helpers for CLI scripts.
 *
 * Scripts run outside any Next.js request, so they have no user JWT — every
 * Convex call must include the `_secret` arg matching `WORKFLOW_SECRET` on
 * the deployment. This helper returns a thin wrapper around `ConvexHttpClient`
 * whose `mutation` / `query` methods inject the secret automatically, so
 * scripts can call `convex.mutation(api.X.Y, args)` like before.
 */

import { ConvexHttpClient } from 'convex/browser';
import type { FunctionReference } from 'convex/server';
import { env } from '@/env';

function workflowSecret(): string {
  const s = process.env.WORKFLOW_SECRET;
  if (!s) {
    throw new Error(
      'WORKFLOW_SECRET unset in .env.local — required for scripts to talk to Convex. ' +
        'Set it locally to match the value on the Convex deployment.',
    );
  }
  return s;
}

export type ScriptConvexClient = {
  mutation<F extends FunctionReference<'mutation', 'public'>>(
    fn: F,
    args?: F['_args'],
  ): Promise<F['_returnType']>;
  query<F extends FunctionReference<'query', 'public'>>(
    fn: F,
    args?: F['_args'],
  ): Promise<F['_returnType']>;
};

export function convexClient(): ScriptConvexClient {
  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error(
      'NEXT_PUBLIC_CONVEX_URL is not set — run `npx convex dev` once to provision the deployment.',
    );
  }
  const raw = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  return {
    mutation: (fn, args) =>
      raw.mutation(fn, {
        ...((args ?? {}) as Record<string, unknown>),
        _secret: workflowSecret(),
      } as never),
    query: (fn, args) =>
      raw.query(fn, {
        ...((args ?? {}) as Record<string, unknown>),
        _secret: workflowSecret(),
      } as never),
  };
}
