/**
 * Model pricing table. USD per 1M tokens.
 *
 * Prices not verified upstream — treat as approximations until cross-checked
 * with Google's published Gemini 3.1 rates. Update in one place as rates
 * change; callers get `null` when a model isn't in the table, which the UI
 * renders as "—" (cost unknown) while still showing tokens.
 */

type ModelPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
  reasoningPerMillion?: number; // defaults to outputPerMillion if unset
};

export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Placeholder — fill in with the verified Gemini 3.1 Pro preview rate.
  // Leaving empty means cost shows as "—" until pricing is confirmed.
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
  const input = ((usage.inputTokens ?? 0) * p.inputPerMillion) / 1_000_000;
  const output = ((usage.outputTokens ?? 0) * p.outputPerMillion) / 1_000_000;
  const reasoning =
    ((usage.reasoningTokens ?? 0) * (p.reasoningPerMillion ?? p.outputPerMillion)) /
    1_000_000;
  return input + output + reasoning;
}
