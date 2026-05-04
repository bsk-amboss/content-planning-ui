/**
 * Resolve provider API keys for a workflow run.
 *
 * Per-user keys (stored in Convex via the Settings page) take priority over
 * env-level fallbacks. Used by every API route that kicks off an LLM
 * workflow — they call this with the set of providers their run actually
 * needs, then pass the resulting `ProviderApiKeys` bag to the workflow
 * function.
 *
 * The route handler is responsible for the missing-key gate: if a needed
 * provider's key resolves to `undefined` here, the route should return
 * `409 { code: 'MISSING_API_KEY', provider }` BEFORE calling `start(...)`.
 * That gate lands in slice 6 of this feature; for now this helper just
 * returns whatever it found.
 */

import { env } from '@/env';
import { fetchQueryAsUser } from '@/lib/convex/server';
import { api } from '../../../../convex/_generated/api';
import type { ProviderApiKeys, ProviderId } from './llm';

const ENV_BY_PROVIDER: Record<ProviderId, string | undefined> = {
  google: env.GOOGLE_GENERATIVE_AI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  openai: env.OPENAI_API_KEY,
};

export async function resolveApiKeysForRun(
  providers: readonly ProviderId[],
): Promise<ProviderApiKeys> {
  const result: ProviderApiKeys = {};
  // Read per-user keys in parallel; each query is auth-gated to the calling
  // user, so concurrent calls in the same request are safe.
  const lookups = await Promise.all(
    providers.map(async (p) => {
      const userKey = await fetchQueryAsUser(api.apiKeys.getOwnKeyForCurrentUser, {
        provider: p,
      });
      return [p, userKey] as const;
    }),
  );
  for (const [p, userKey] of lookups) {
    const fallback = ENV_BY_PROVIDER[p];
    const resolved = userKey ?? fallback;
    if (resolved) result[p] = resolved;
  }
  return result;
}
