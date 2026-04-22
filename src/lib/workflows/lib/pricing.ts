/**
 * Model pricing table. USD per 1M tokens.
 *
 * Last verified 2026-04-22 against:
 *   - https://ai.google.dev/gemini-api/docs/pricing
 *   - https://claude.com/pricing
 *   - https://developers.openai.com/api/docs/pricing
 *
 * Simplifications baked in:
 *   - Gemini Pro/2.5 have two tiers (≤200k vs >200k context). We use the
 *     ≤200k tier; heavy-context calls will be undercounted.
 *   - OpenAI has batch/flex/priority variants; we use Standard.
 *   - Anthropic prompt-caching has a write price (more expensive) and a
 *     read price (cheaper). AI SDK reports `cachedInputTokens` = read hits,
 *     so we price those at the read rate. Cache writes cost slightly more
 *     than raw input; they show up under `inputTokens` here and are
 *     slightly underpriced — ignore for back-of-envelope totals.
 *   - Cached-input tokens are subtracted from `inputTokens` and charged at
 *     the cache rate. Callers that don't set `cachedInputTokens` are billed
 *     as if everything was fresh input.
 *
 * Update when rates change — callers get `null` when a model isn't in the
 * table, which the UI renders as "—" (cost unknown) while still showing
 * tokens.
 */

type ModelPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
  /** Defaults to `outputPerMillion` if unset. */
  reasoningPerMillion?: number;
  /** Defaults to `inputPerMillion` if unset (i.e. no cache discount). */
  cachedInputPerMillion?: number;
};

export const MODEL_PRICES: Record<string, ModelPrice> = {
  // --- Google Gemini (https://ai.google.dev/gemini-api/docs/pricing) -------
  // Pro and 2.5 Pro have tiered context pricing (≤200k / >200k); we use the
  // ≤200k tier.
  'gemini-3.1-pro-preview': {
    inputPerMillion: 2.0,
    outputPerMillion: 12.0,
    cachedInputPerMillion: 0.2,
  },
  'gemini-3.1-flash-lite-preview': {
    inputPerMillion: 0.25,
    outputPerMillion: 1.5,
    cachedInputPerMillion: 0.025,
  },
  'gemini-2.5-pro': {
    inputPerMillion: 1.25,
    outputPerMillion: 10.0,
    cachedInputPerMillion: 0.125,
  },
  'gemini-2.5-flash': {
    inputPerMillion: 0.3,
    outputPerMillion: 2.5,
    cachedInputPerMillion: 0.03,
  },
  'gemini-2.5-flash-lite': {
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
    cachedInputPerMillion: 0.01,
  },
  'gemini-2.0-flash': {
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
    cachedInputPerMillion: 0.025,
  },
  'gemini-2.0-flash-lite': {
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
  },

  // --- Anthropic Claude (https://claude.com/pricing) -----------------------
  // `cachedInputPerMillion` is the prompt-caching READ rate. Cache writes
  // (more expensive than raw input) aren't modeled separately — the token
  // counter AI SDK surfaces is ambiguous about them.
  'claude-opus-4-7': {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cachedInputPerMillion: 0.5,
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cachedInputPerMillion: 0.3,
  },
  'claude-haiku-4-5': {
    inputPerMillion: 1.0,
    outputPerMillion: 5.0,
    cachedInputPerMillion: 0.1,
  },

  // --- OpenAI (https://developers.openai.com/api/docs/pricing) -------------
  // Standard tier. Batch/flex are roughly 50% cheaper; priority is pricier.
  'gpt-5.4': {
    inputPerMillion: 2.5,
    outputPerMillion: 15.0,
    cachedInputPerMillion: 0.25,
  },
  'gpt-5.4-mini': {
    inputPerMillion: 0.75,
    outputPerMillion: 4.5,
    cachedInputPerMillion: 0.075,
  },
  'gpt-5.4-nano': {
    inputPerMillion: 0.2,
    outputPerMillion: 1.25,
    cachedInputPerMillion: 0.02,
  },
  'gpt-5.4-pro': {
    inputPerMillion: 30.0,
    outputPerMillion: 180.0,
  },
  'gpt-5.3-chat-latest': {
    inputPerMillion: 1.75,
    outputPerMillion: 14.0,
    cachedInputPerMillion: 0.175,
  },
  'gpt-5.3-codex': {
    inputPerMillion: 1.75,
    outputPerMillion: 14.0,
    cachedInputPerMillion: 0.175,
  },
};

export type UsageInput = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
};

export function estimateCostUsd(model: string, usage: UsageInput): number | null {
  const p = MODEL_PRICES[model];
  if (!p) return null;
  const cached = usage.cachedInputTokens ?? 0;
  // AI SDK reports inputTokens as the total (including cached hits); split so
  // the cache discount applies.
  const uncached = Math.max(0, (usage.inputTokens ?? 0) - cached);
  const inputCost = (uncached * p.inputPerMillion) / 1_000_000;
  const cacheCost = (cached * (p.cachedInputPerMillion ?? p.inputPerMillion)) / 1_000_000;
  const outputCost = ((usage.outputTokens ?? 0) * p.outputPerMillion) / 1_000_000;
  const reasoningCost =
    ((usage.reasoningTokens ?? 0) * (p.reasoningPerMillion ?? p.outputPerMillion)) /
    1_000_000;
  return inputCost + cacheCost + outputCost + reasoningCost;
}
