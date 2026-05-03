/**
 * Thin server-side wrappers around `convex/nextjs` helpers that automatically
 * attach the signed-in user's auth token. Use these from RSC pages, route
 * handlers, and server actions so `requireUser`/`requireUserOrService` checks
 * inside Convex functions see the request's user.
 *
 * Workflow code and CLI scripts must NOT use these — they call Convex from
 * outside a request context and have no user JWT. They should pass
 * `_secret: process.env.WORKFLOW_SECRET` to the function args instead.
 */

import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import {
  fetchMutation,
  fetchQuery,
  type NextjsOptions,
  preloadQuery,
} from 'convex/nextjs';
import type { FunctionReference } from 'convex/server';

async function authedOptions(extra?: NextjsOptions): Promise<NextjsOptions> {
  const token = await convexAuthNextjsToken();
  return { ...extra, token: extra?.token ?? token };
}

export async function fetchQueryAsUser<Q extends FunctionReference<'query', 'public'>>(
  fn: Q,
  args?: Q['_args'],
  options?: NextjsOptions,
): Promise<Q['_returnType']> {
  return fetchQuery(fn, args ?? ({} as Q['_args']), await authedOptions(options));
}

export async function fetchMutationAsUser<
  M extends FunctionReference<'mutation', 'public'>,
>(fn: M, args?: M['_args'], options?: NextjsOptions): Promise<M['_returnType']> {
  return fetchMutation(fn, args ?? ({} as M['_args']), await authedOptions(options));
}

export async function preloadQueryAsUser<Q extends FunctionReference<'query', 'public'>>(
  fn: Q,
  args?: Q['_args'],
  options?: NextjsOptions,
) {
  return preloadQuery(fn, args ?? ({} as Q['_args']), await authedOptions(options));
}
