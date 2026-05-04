/**
 * Parse + validate a `ModelSpec` from a JSON request body. Returns either
 * the spec or an error string suitable for a 400 response.
 *
 * Validation:
 *   - The (provider, model) pair must appear in `MODEL_CATALOG` — guarantees
 *     the workflow is only ever asked to call models we've vetted + priced.
 *   - `reasoning` must be one of the universal levels.
 *
 * The browser-side persistence layer also applies these rules, so a
 * well-behaved client should never trip them — this guards against tampered
 * requests and forwards-compatibility skews.
 */

import { isCatalogEntry, type ModelSpec, REASONING_LEVELS } from './llm';

export type ParseModelOk = { ok: true; spec: ModelSpec };
export type ParseModelErr = { ok: false; error: string };
export type ParseModelResult = ParseModelOk | ParseModelErr;

export function parseModelSpec(raw: unknown): ParseModelResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'model is required' };
  }
  const obj = raw as Record<string, unknown>;
  const provider = obj.provider;
  const model = obj.model;
  const reasoning = obj.reasoning;
  if (typeof provider !== 'string' || typeof model !== 'string') {
    return { ok: false, error: 'model.{provider,model} must be strings' };
  }
  if (!isCatalogEntry(provider, model)) {
    return { ok: false, error: `unknown model: ${provider}::${model}` };
  }
  if (
    typeof reasoning !== 'string' ||
    !REASONING_LEVELS.includes(reasoning as (typeof REASONING_LEVELS)[number])
  ) {
    return {
      ok: false,
      error: `model.reasoning must be one of ${REASONING_LEVELS.join(', ')}`,
    };
  }
  return {
    ok: true,
    spec: {
      provider: provider as ModelSpec['provider'],
      model,
      reasoning: reasoning as ModelSpec['reasoning'],
    },
  };
}
