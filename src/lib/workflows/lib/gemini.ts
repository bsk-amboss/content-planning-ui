/**
 * Gemini-backed extraction steps (preprocessing stage).
 *
 * Ports the two n8n workflows verbatim:
 *   - `content_outline_extractor_subworkflow.json` → identifyModulesForUrl
 *   - `content_outline_category_extractor_subworkflow.json` → extractCodesForCategory
 *
 * Uses AI SDK v6 generateText with @ai-sdk/google, the `url_context` tool, and
 * Gemini 3 Pro preview. Output is raw JSON — parsed leniently to survive code
 * fences or stray whitespace, then Zod-validated.
 *
 * Falls back to stub outputs when `GOOGLE_GENERATIVE_AI_API_KEY` is absent so
 * the durability plumbing can still be exercised without creds.
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { z } from 'zod';
import { env } from '@/env';
import type { StageName } from './db-writes';
import { logEvent } from './events';
import { estimateCostUsd } from './pricing';

const MODEL_ID = 'gemini-3.1-pro-preview';

// --- shared schemas ---------------------------------------------------------

export const ExtractedCodeSchema = z.object({
  code: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  metadata: z.unknown().optional(),
});

export type RawExtractedCode = z.infer<typeof ExtractedCodeSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

export type MilestoneDraft = {
  version: number;
  milestones: Milestone[];
};

const IdentifyModulesOutputSchema = z.array(z.object({ category: z.string() }));
const ExtractCodesOutputSchema = z.array(
  z.object({ category: z.string(), description: z.string() }),
);

export function hasGeminiCreds(): boolean {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
}

// --- n8n-sourced system prompts --------------------------------------------

const DEFAULT_IDENTIFY_SYSTEM_PROMPT = `
You are a medical education content extraction specialist. Each URL context will provide you a content outline for that specialty.

You need to identify the unique chapters to chunk the content outline. These chunks are needed to break down the document to later extract the medical items from the document. These should correspond to logical hierarchies in the document, to break up the task to make it more manageable. You should return a list of categories, without it being too granular or too wide. The categories should be based on the hierarchies in the document and will be used in a subsequent step to loop over each category for item extraction.

CRITICAL: the list of categories must be exhaustive so that ALL items can be extracted when looping over the document! Make sure to scan the entire document and not only the table of contents!

You must return exclusively a JSON array with no preceding or trailing text with the following information for each item:
[
  {
    "category": "the base category"
  }
]
`.trim();

const DEFAULT_EXTRACT_SYSTEM_PROMPT = `
You are a medical education content extraction specialist.

The user will provide you with:
- content outline URL
- chunk

Your job is to load the URL context provided and extract the medical items and hierarchy from the document for the given chunk. Each URL context will provide you a content outline for that specialty. Be extremely deliberate, even if it means extracting hundreds if not thousands of items for that chunk. Return exclusively codes in the chunk and none outside!

Each description should be a discrete term in the hierarchy. For example, 'Diagnose and manage allergic rhinitis and allergic conjunctivitis' should be separate for each disease.

Extract all diseases, symptoms, problems, conditions, diagnostic tools, clinical skills, and procedures mentioned in the document chunk. Each item must be discrete and descriptive and have all the information it needs to be contextualized. Extract every piece of the hierarchy as well as its own item.

For each extraction, return the full medical category or all relevant hierarchy ancestors of the code. This should be a medical subcategory, not a classification like 'disease' or 'condition'. Good examples would be something like 'Cutaneous Disorders' or 'Procedures and Skills Integral to the Practice of Emergency Medicine'. If there are many categories or deeply nested ones in a hierarchy, return them all.

You must return exclusively a JSON with no preceding or trailing text with the following information for each item:
[
  {
    "category": "the category including all hierarchical information. Separate each hierarchy using a pipe separator |",
    "description": "the item"
  }
]
`.trim();

// --- parsing helpers --------------------------------------------------------

function parseJsonArray(raw: string): unknown {
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const text = (fenceMatch ? fenceMatch[1] : raw).trim();
  const first = text.indexOf('[');
  const last = text.lastIndexOf(']');
  if (first < 0 || last < 0 || last <= first) {
    throw new Error(`Model response had no JSON array: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(first, last + 1));
}

// --- Phase 1: identify modules per PDF --------------------------------------

export async function identifyModulesForUrl(input: {
  url: string;
  systemPrompt: string;
  specialtySlug: string;
  runId: string;
  stage: StageName;
}): Promise<{ category: string }[]> {
  'use step';
  console.log('[pipeline] identifyModulesForUrl', {
    specialtySlug: input.specialtySlug,
    url: input.url,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Phase 1 (stub): identified 2 modules for ${input.url}`,
      metrics: { url: input.url },
    });
    return [{ category: 'Stubbed Module A' }, { category: 'Stubbed Module B' }];
  }

  const system = input.systemPrompt?.trim() || DEFAULT_IDENTIFY_SYSTEM_PROMPT;
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
    metrics: { url: input.url, model: MODEL_ID },
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

    const parsed = parseJsonArray(result.text);
    const modules = IdentifyModulesOutputSchema.parse(parsed);
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
      metrics: { durationMs, ...usage, costUsd, model: MODEL_ID, url: input.url },
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
      metrics: { durationMs, url: input.url, model: MODEL_ID },
    });
    throw e;
  }
}

// --- Phase 2: extract codes per (url, module) -------------------------------

export async function extractCodesForCategory(input: {
  url: string;
  category: string;
  specialtySlug: string;
  systemPrompt: string;
  runId: string;
  stage: StageName;
}): Promise<{ category: string; description: string }[]> {
  'use step';
  console.log('[pipeline] extractCodesForCategory', {
    specialtySlug: input.specialtySlug,
    url: input.url,
    category: input.category,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Phase 2 (stub): extracted 2 items for ${input.category}`,
      metrics: { url: input.url, category: input.category },
    });
    return [
      { category: `${input.category} | Sub A`, description: 'Stubbed item 1' },
      { category: `${input.category} | Sub B`, description: 'Stubbed item 2' },
    ];
  }

  const system = input.systemPrompt?.trim() || DEFAULT_EXTRACT_SYSTEM_PROMPT;
  const userMessage = `
You are extracting medical items for the medical specialty: ${input.specialtySlug}.

Please load and analyze the content at the following URL(s):
${input.url}

Extract only codes in the chunk:
${input.category}

Extract all medical items from the document and return exclusively an output in JSON format, with no other text.
`.trim();

  await logEvent({
    runId: input.runId,
    stage: input.stage,
    level: 'info',
    message: `Phase 2: extracting codes for (${input.category})`,
    metrics: { url: input.url, category: input.category, model: MODEL_ID },
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

    const parsed = parseJsonArray(result.text);
    const codes = ExtractCodesOutputSchema.parse(parsed);
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
        category: input.category,
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
      metrics: { durationMs, url: input.url, category: input.category, model: MODEL_ID },
    });
    throw e;
  }
}

// --- Milestones (still stubbed; n8n workflow not shared yet) ----------------

export async function extractMilestonesFromPdfs(input: {
  specialtySlug: string;
  pdfUrls: string[];
}): Promise<MilestoneDraft> {
  'use step';
  console.log('[pipeline] extractMilestonesFromPdfs', {
    specialtySlug: input.specialtySlug,
    pdfCount: input.pdfUrls.length,
    stubbed: !hasGeminiCreds(),
  });
  if (!hasGeminiCreds()) {
    return {
      version: 1,
      milestones: [
        { id: 'M1', title: 'Stubbed milestone 1', description: 'Placeholder' },
        { id: 'M2', title: 'Stubbed milestone 2', description: 'Placeholder' },
      ],
    };
  }
  throw new Error(
    'Real Gemini milestone extraction not yet wired. Share the n8n milestones workflow to flesh this out.',
  );
}
