/**
 * Gemini-backed extraction steps (preprocessing stage).
 *
 * Ports the two n8n workflows verbatim:
 *   - `content_outline_extractor_subworkflow.json` → identifyModulesForUrl
 *   - `content_outline_category_extractor_subworkflow.json` → extractCodesForCategory
 *
 * Uses AI SDK v6 generateText with @ai-sdk/google, the `url_context` tool,
 * Gemini 3 Pro preview, and `Output.array` for typed structured output —
 * the SDK negotiates Gemini's native responseSchema, so we no longer parse
 * JSON by hand or worry about fenced responses.
 *
 * Falls back to stub outputs when `GOOGLE_GENERATIVE_AI_API_KEY` is absent so
 * the durability plumbing can still be exercised without creds.
 */

import { google } from '@ai-sdk/google';
import { generateText, Output, stepCountIs } from 'ai';
import { z } from 'zod';
import { env } from '@/env';
import type { StageName } from './db-writes';
import { logEvent } from './events';
import { estimateCostUsd } from './pricing';
import {
  DEFAULT_EXTRACT_SYSTEM_PROMPT,
  DEFAULT_IDENTIFY_SYSTEM_PROMPT,
  DEFAULT_MILESTONES_SYSTEM_PROMPT,
} from './prompts';
import type { ContentInput } from './sources';

export {
  DEFAULT_EXTRACT_SYSTEM_PROMPT,
  DEFAULT_IDENTIFY_SYSTEM_PROMPT,
  DEFAULT_MILESTONES_SYSTEM_PROMPT,
};

const MODEL_ID = 'gemini-3.1-pro-preview';

// --- shared schemas ---------------------------------------------------------

export const ExtractedCodeSchema = z.object({
  code: z.string(),
  category: z.string().optional(),
  consolidationCategory: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  metadata: z.unknown().optional(),
});

export type RawExtractedCode = z.infer<typeof ExtractedCodeSchema>;

// Per-element schemas used with the AI SDK's `Output.array`. The SDK enforces
// these against Gemini's native structured-output constraint — no manual
// JSON parsing or Zod validation needed downstream.
const IdentifyModulesElementSchema = z.object({ category: z.string() });
const ExtractCodesElementSchema = z.object({
  category: z.string(),
  description: z.string(),
});

// Both phase steps use url_context, which produces extra steps (one per URL
// fetch). The structured-output emission counts as its own step too, so
// budget generously.
const MAX_STEPS = 5;

export function hasGeminiCreds(): boolean {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
}

// Prompt composition helper shared by both phase steps.

/**
 * Compose the effective system prompt: default, optionally followed by an
 * `## Additional instructions` block when the caller supplied extra guidance.
 * This lets the UI expose lightweight per-phase overrides without forcing
 * users to replace the whole n8n-sourced prompt.
 */
function composePrompt(defaultPrompt: string, additional?: string): string {
  const extra = additional?.trim();
  if (!extra) return defaultPrompt;
  return `${defaultPrompt}\n\n## Additional instructions\n\n${extra}`;
}

// --- Phase 1: identify modules per PDF --------------------------------------

export async function identifyModulesForUrl(input: {
  url: string;
  source?: string;
  additionalInstructions?: string;
  specialtySlug: string;
  runId: string;
  stage: StageName;
}): Promise<{ category: string }[]> {
  'use step';
  console.log('[pipeline] identifyModulesForUrl', {
    specialtySlug: input.specialtySlug,
    url: input.url,
    source: input.source,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Phase 1 (stub): identified 2 modules for ${input.url}`,
      metrics: { url: input.url, source: input.source },
    });
    return [{ category: 'Stubbed Module A' }, { category: 'Stubbed Module B' }];
  }

  const system = composePrompt(
    DEFAULT_IDENTIFY_SYSTEM_PROMPT,
    input.additionalInstructions,
  );
  const userMessage = `
Please load and analyze the content at the following URL(s):
${input.url}

Identify the base hierarchies in the document and return exclusively an output in JSON array format, with no other text.
`.trim();

  await logEvent({
    runId: input.runId,
    stage: input.stage,
    level: 'info',
    message: `Phase 1: identifying modules for ${input.url}`,
    metrics: { url: input.url, source: input.source, model: MODEL_ID },
  });

  const started = Date.now();
  try {
    const result = await generateText({
      model: google(MODEL_ID),
      system,
      prompt: userMessage,
      tools: { url_context: google.tools.urlContext({}) },
      output: Output.array({ element: IdentifyModulesElementSchema }),
      stopWhen: stepCountIs(MAX_STEPS),
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: 'high' } },
      },
      temperature: 1,
      topP: 0.95,
      topK: 64,
    });

    const modules = result.output;
    const durationMs = Date.now() - started;
    const usage = {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      reasoningTokens: result.usage?.reasoningTokens,
      cachedInputTokens: result.usage?.cachedInputTokens,
    };
    const costUsd = estimateCostUsd(MODEL_ID, usage);
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Phase 1 done: ${modules.length} modules from ${input.url}`,
      metrics: {
        durationMs,
        ...usage,
        costUsd,
        model: MODEL_ID,
        url: input.url,
        source: input.source,
        phase: 'identify',
        completion: modules,
      },
    });
    return modules;
  } catch (e) {
    const durationMs = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'error',
      message: `Phase 1 failed for ${input.url}: ${msg}`,
      metrics: { durationMs, url: input.url, source: input.source, model: MODEL_ID },
    });
    throw e;
  }
}

// --- Phase 2: extract codes per (url, module) -------------------------------

export async function extractCodesForCategory(input: {
  url: string;
  source?: string;
  category: string;
  specialtySlug: string;
  additionalInstructions?: string;
  runId: string;
  stage: StageName;
}): Promise<{ category: string; description: string }[]> {
  'use step';
  console.log('[pipeline] extractCodesForCategory', {
    specialtySlug: input.specialtySlug,
    url: input.url,
    source: input.source,
    category: input.category,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Phase 2 (stub): extracted 2 items for ${input.category}`,
      metrics: { url: input.url, source: input.source, category: input.category },
    });
    return [
      { category: `${input.category} | Sub A`, description: 'Stubbed item 1' },
      { category: `${input.category} | Sub B`, description: 'Stubbed item 2' },
    ];
  }

  const system = composePrompt(
    DEFAULT_EXTRACT_SYSTEM_PROMPT,
    input.additionalInstructions,
  );
  const userMessage = `
You are extracting medical items for the medical specialty: ${input.specialtySlug}.

Please load and analyze the content at the following URL(s):
${input.url}

Extract only codes in the chunk and do not invent any codes or descriptions that are not explicitly mentioned:
${input.category}

Extract all medical items from the document and return exclusively an output in JSON format, with no other text. 
`.trim();

  await logEvent({
    runId: input.runId,
    stage: input.stage,
    level: 'info',
    message: `Phase 2: extracting codes for (${input.category})`,
    metrics: {
      url: input.url,
      source: input.source,
      category: input.category,
      model: MODEL_ID,
    },
  });

  const started = Date.now();
  try {
    const result = await generateText({
      model: google(MODEL_ID),
      system,
      prompt: userMessage,
      tools: { url_context: google.tools.urlContext({}) },
      output: Output.array({ element: ExtractCodesElementSchema }),
      stopWhen: stepCountIs(MAX_STEPS),
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: 'high' } },
      },
      temperature: 1,
      topP: 0.95,
      topK: 64,
    });

    const codes = result.output;
    const durationMs = Date.now() - started;
    const usage = {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      reasoningTokens: result.usage?.reasoningTokens,
      cachedInputTokens: result.usage?.cachedInputTokens,
    };
    const costUsd = estimateCostUsd(MODEL_ID, usage);
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Phase 2 done: ${codes.length} codes for (${input.category})`,
      metrics: {
        durationMs,
        ...usage,
        costUsd,
        model: MODEL_ID,
        url: input.url,
        source: input.source,
        category: input.category,
        phase: 'extract',
        completion: codes,
      },
    });
    return codes;
  } catch (e) {
    const durationMs = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'error',
      message: `Phase 2 failed for (${input.category}): ${msg}`,
      metrics: {
        durationMs,
        url: input.url,
        source: input.source,
        category: input.category,
        model: MODEL_ID,
      },
    });
    throw e;
  }
}

// --- Milestones ------------------------------------------------------------
//
// Single-call extraction: Gemini reads every provided URL via `url_context`
// and synthesizes a single plain-text milestones blob. Stubbed when no
// `GOOGLE_GENERATIVE_AI_API_KEY` is set so the durability path still runs.

export async function extractMilestonesForInputs(input: {
  inputs: ContentInput[];
  specialtySlug: string;
  additionalInstructions?: string;
  runId: string;
  stage: StageName;
}): Promise<string> {
  'use step';
  console.log('[pipeline] extractMilestonesForInputs', {
    specialtySlug: input.specialtySlug,
    inputs: input.inputs.length,
    stubbed: !hasGeminiCreds(),
  });

  if (!hasGeminiCreds()) {
    const stub = [
      'MK-1. Stubbed medical knowledge milestone.',
      'PC-1. Stubbed patient care milestone.',
      'SBP-1. Stubbed systems-based practice milestone.',
    ].join('\n');
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Milestones (stub): produced ${stub.length} chars for ${input.inputs.length} input(s)`,
      metrics: {
        phase: 'milestones',
        completion: stub,
      },
    });
    return stub;
  }

  const system = composePrompt(
    DEFAULT_MILESTONES_SYSTEM_PROMPT,
    input.additionalInstructions,
  );
  // Match the n8n specialty_milestone_extractor user-message template so the
  // combined {system, user} contract the model sees stays identical. Multiple
  // URLs are supported by listing them under the same "URL(s)" line.
  const urlList = input.inputs.map((i) => `- ${i.url} (source: ${i.source})`).join('\n');
  const userMessage = `
You are extracting milestones for the medical specialty: ${input.specialtySlug}.

Please load and analyze the content at the following URL(s):
${urlList}

Extract all patient care and medical knowledge milestones from the document and return them as a structured ordered list.
`.trim();

  await logEvent({
    runId: input.runId,
    stage: input.stage,
    level: 'info',
    message: `Milestones: extracting across ${input.inputs.length} input(s)`,
    metrics: { model: MODEL_ID, phase: 'milestones' },
  });

  const started = Date.now();
  try {
    const result = await generateText({
      model: google(MODEL_ID),
      system,
      prompt: userMessage,
      tools: { url_context: google.tools.urlContext({}) },
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: 'high' } },
      },
      temperature: 1,
      topP: 0.95,
      topK: 64,
    });

    const milestones = result.text.trim();
    if (milestones.length === 0) {
      throw new Error('Model returned empty milestones output');
    }
    const durationMs = Date.now() - started;
    const usage = {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      reasoningTokens: result.usage?.reasoningTokens,
      cachedInputTokens: result.usage?.cachedInputTokens,
    };
    const costUsd = estimateCostUsd(MODEL_ID, usage);
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Milestones done: ${milestones.length} chars`,
      metrics: {
        durationMs,
        ...usage,
        costUsd,
        model: MODEL_ID,
        phase: 'milestones',
        completion: milestones,
      },
    });
    return milestones;
  } catch (e) {
    const durationMs = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'error',
      message: `Milestones failed: ${msg}`,
      metrics: { durationMs, model: MODEL_ID, phase: 'milestones' },
    });
    throw e;
  }
}
