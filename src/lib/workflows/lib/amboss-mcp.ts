/**
 * AMBOSS MCP-backed mapping step.
 *
 * Per-code attempt ladder, executed entirely inside one `"use step"` so a
 * crash retries the whole loop for just that code (each code is independent
 * and steps cache on return):
 *
 *   1. `gemini-3-flash-preview`   (fallback `gemini-2.5-flash` on provider-not-found)
 *   2. flash, same, + CORRECTION listing invalid IDs from attempt 1
 *   3. flash, same, + cumulative CORRECTION
 *   4. `claude-opus-4-7`          (only when attempts 1-3 still have invalid IDs)
 *
 * Validation: every cited `articleId` / `sectionId` in the LLM output is
 * checked against the local `amboss_articles` / `amboss_sections` catalog.
 * When `checkAgainstLibrary` is false, the ladder short-circuits after the
 * first well-formed parse — matching the user's "raw output" toggle behavior.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createMCPClient } from '@ai-sdk/mcp';
import { generateText } from 'ai';
import { z } from 'zod';
import { env } from '@/env';
import {
  getAmbossLibraryStats,
  listAmbossArticleIds,
  listAmbossSectionIds,
} from '@/lib/data/amboss-library';
import type { StageName } from './db-writes';
import { logEvent } from './events';
import { estimateCostUsd } from './pricing';
import {
  DEFAULT_MAPPING_SYSTEM_PROMPT,
  DEFAULT_MAPPING_USER_MESSAGE_TEMPLATE,
} from './prompts';

// ---------------------------------------------------------------------------
// Model identifiers. The first flash ID is the n8n default; if the provider
// rejects it (not yet exposed via @ai-sdk/google), the workflow falls back to
// the GA flash once per run (tracked in a module-scope flag) and logs the
// fallback as a warn-level event.
// ---------------------------------------------------------------------------

const FLASH_PREVIEW_MODEL = 'gemini-3-flash-preview';
const FLASH_FALLBACK_MODEL = 'gemini-2.5-flash';
const OPUS_MODEL = 'claude-opus-4-7';

let flashFallbackTriggered = false;
function currentFlashModel(): string {
  return flashFallbackTriggered ? FLASH_FALLBACK_MODEL : FLASH_PREVIEW_MODEL;
}

// ---------------------------------------------------------------------------
// Output schema (mirrors the n8n agent output).
// ---------------------------------------------------------------------------

const SectionsBlockSchema = z.union([
  // n8n output form: `{ "title": "id", "title2": "id2" }` (the inner object
  // is a map of section title → section ID).
  z.record(z.string(), z.string()),
  // Some models emit arrays of `{ sectionTitle, sectionId }`.
  z.array(
    z.object({
      sectionTitle: z.string().optional(),
      sectionId: z.string().optional(),
    }),
  ),
]);

const CoveredSectionSchema = z.object({
  articleTitle: z.string().optional(),
  articleId: z.string(),
  sections: SectionsBlockSchema.optional(),
});

const SectionUpdateSchema = z.object({
  articleTitle: z.string().optional(),
  articleId: z.string(),
  sections: z
    .array(
      z.object({
        sectionTitle: z.string().optional(),
        sectionId: z.string().optional(),
        exists: z.boolean().optional(),
        changes: z.string().optional(),
        importance: z.number().optional(),
      }),
    )
    .optional(),
});

const NewArticleSchema = z.object({
  articleTitle: z.string(),
  importance: z.number().optional(),
});

const MappingOutputSchema = z.object({
  code: z.string().optional(),
  description: z.string().optional(),
  coverage: z.object({
    inAMBOSS: z.boolean(),
    coveredSections: z.array(CoveredSectionSchema).default([]),
    generalNotes: z.string().optional().default(''),
    gaps: z.string().optional().default(''),
    coverageLevel: z.string().optional().default('none'),
    coverageScore: z.union([z.number(), z.string()]).optional(),
  }),
  suggestion: z
    .object({
      improvement: z.string().optional().default(''),
      sectionUpdates: z.array(SectionUpdateSchema).optional().default([]),
      newArticlesNeeded: z.array(NewArticleSchema).optional().default([]),
    })
    .optional()
    .default({ improvement: '', sectionUpdates: [], newArticlesNeeded: [] }),
  currentAMBOSSContentMetadata: z.unknown().optional(),
});

export type MappingOutput = z.infer<typeof MappingOutputSchema>;

export type MappingResult = {
  mapping: MappingOutput;
  attempts: number;
  model: string;
  invalidIds: string[];
  /** `true` when every attempt in the ladder still produced invalid IDs. The
   *  mapping is still written through (last attempt's output) but the stage
   *  summary surfaces the count. */
  unresolved: boolean;
};

export function hasMappingCreds(): boolean {
  return Boolean(env.AMBOSS_MCP_URL && env.AMBOSS_MCP_TOKEN);
}

export async function getMappingLibraryStats() {
  'use step';
  return getAmbossLibraryStats();
}

// ---------------------------------------------------------------------------
// JSON extraction: the prompt asks for bare JSON but occasionally the model
// fences or prepends prose. Strip fences and trim to the outermost braces.
// ---------------------------------------------------------------------------

function parseAgentJson(raw: string): unknown {
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const text = (fenceMatch ? fenceMatch[1] : raw).trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last < 0 || last <= first) {
    throw new Error(`Model response had no JSON object: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(first, last + 1));
}

// ---------------------------------------------------------------------------
// Walk the parsed mapping and collect every article/section ID it cites. Used
// both for validation (caller intersects against known ID sets) and for the
// metrics rolled into the event log.
// ---------------------------------------------------------------------------

function collectCitedIds(mapping: MappingOutput): {
  articleIds: string[];
  sectionIds: string[];
} {
  const articleIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const cs of mapping.coverage.coveredSections ?? []) {
    if (cs.articleId) articleIds.add(cs.articleId);
    const s = cs.sections;
    if (s && !Array.isArray(s)) {
      for (const id of Object.values(s)) if (id) sectionIds.add(id);
    } else if (Array.isArray(s)) {
      for (const sec of s) if (sec.sectionId) sectionIds.add(sec.sectionId);
    }
  }
  for (const upd of mapping.suggestion.sectionUpdates ?? []) {
    if (upd.articleId) articleIds.add(upd.articleId);
    for (const s of upd.sections ?? []) if (s.sectionId) sectionIds.add(s.sectionId);
  }
  return { articleIds: [...articleIds], sectionIds: [...sectionIds] };
}

export function validateMappingIds(
  mapping: MappingOutput,
  articleSet: Set<string>,
  sectionSet: Set<string>,
): string[] {
  const { articleIds, sectionIds } = collectCitedIds(mapping);
  const invalid: string[] = [];
  for (const id of articleIds) if (!articleSet.has(id)) invalid.push(id);
  for (const id of sectionIds) if (!sectionSet.has(id)) invalid.push(id);
  return [...new Set(invalid)];
}

// ---------------------------------------------------------------------------
// Prompt helpers.
// ---------------------------------------------------------------------------

function composeSystem(milestones: string, additional?: string): string {
  // The system-prompt source contains a literal `${milestones}` placeholder
  // we substitute at runtime — the string on the next line is deliberate.
  const base = DEFAULT_MAPPING_SYSTEM_PROMPT.replace(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional placeholder
    '${milestones}',
    milestones || 'N/A',
  );
  const extra = additional?.trim();
  if (!extra) return base;
  return `${base}\n\n## Additional instructions\n\n${extra}`;
}

function composeUser(input: {
  specialty: string;
  code: string;
  codeCategory: string;
  description: string;
  contentBase: string;
  language: string;
}): string {
  // Same deal: the user-message template contains literal `${...}` tokens that
  // we substitute by name. Each replaceAll target is a deliberate placeholder.
  /* biome-ignore-start lint/suspicious/noTemplateCurlyInString: intentional placeholder */
  return DEFAULT_MAPPING_USER_MESSAGE_TEMPLATE.replaceAll('${specialty}', input.specialty)
    .replaceAll('${code}', input.code)
    .replaceAll('${codeCategory}', input.codeCategory)
    .replaceAll('${description}', input.description)
    .replaceAll('${contentBase}', input.contentBase)
    .replaceAll('${language}', input.language);
  /* biome-ignore-end lint/suspicious/noTemplateCurlyInString: intentional placeholder */
}

function correctionMessage(invalidIds: string[]): string {
  return [
    '',
    '**CORRECTION**',
    `Your previous response cited these IDs that do not exist in the AMBOSS content library: ${JSON.stringify(invalidIds)}.`,
    'Do not cite any IDs outside of what MCP tool responses return. Re-run your MCP queries and only emit IDs you have verified via `get_sections`.',
    'Remember: IDs starting with Y or Z are subsection IDs — never return those as section IDs.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Single model call. Isolated so the attempt loop just swaps model IDs.
// ---------------------------------------------------------------------------

async function runAgentAttempt(params: {
  modelId: string;
  system: string;
  userMessage: string;
  tools: Record<string, unknown>;
}): Promise<{
  text: string;
  usage: ReturnType<typeof pickUsage>;
  mcp: { calls: number; toolNames: string[] };
}> {
  const { modelId, system, userMessage, tools } = params;
  const isClaude = modelId.startsWith('claude-');
  const model = isClaude ? anthropic(modelId) : google(modelId);
  const result = await generateText({
    model,
    system,
    prompt: userMessage,
    // biome-ignore lint/suspicious/noExplicitAny: MCP toolset discovered at runtime; the AI SDK accepts the full set
    tools: tools as any,
    stopWhen: ({ steps }: { steps: Array<unknown> }) => steps.length >= 20,
    temperature: 1,
    ...(isClaude
      ? {}
      : {
          topP: 0.95,
          topK: 64,
          providerOptions: {
            google: { thinkingConfig: { thinkingLevel: 'medium' as const } },
          },
        }),
  });
  return { text: result.text, usage: pickUsage(result.usage), mcp: pickMcp(result) };
}

/**
 * Count MCP tool invocations across all reasoning steps. The AI SDK exposes
 * each round-trip as a `step` with its own `toolCalls`; the top-level
 * `result.toolCalls` only carries the final step's calls. We unique-name them
 * so the modal can show "search_article_sections ×3, get_sections ×8" rather
 * than just a total. Defensively typed because the AI SDK shape isn't
 * guaranteed to be stable across versions and we'd rather drop the metric
 * than crash the workflow.
 */
function pickMcp(result: unknown): { calls: number; toolNames: string[] } {
  try {
    const steps = (
      result as { steps?: Array<{ toolCalls?: Array<{ toolName?: string }> }> }
    )?.steps;
    if (!Array.isArray(steps)) return { calls: 0, toolNames: [] };
    const names: string[] = [];
    for (const step of steps) {
      for (const call of step.toolCalls ?? []) {
        if (call?.toolName) names.push(call.toolName);
      }
    }
    return { calls: names.length, toolNames: names };
  } catch {
    return { calls: 0, toolNames: [] };
  }
}

function pickUsage(
  u:
    | {
        inputTokens?: number;
        outputTokens?: number;
        reasoningTokens?: number;
        cachedInputTokens?: number;
      }
    | undefined,
) {
  return {
    inputTokens: u?.inputTokens,
    outputTokens: u?.outputTokens,
    reasoningTokens: u?.reasoningTokens,
    cachedInputTokens: u?.cachedInputTokens,
  };
}

// ---------------------------------------------------------------------------
// Public step: attempt ladder + validation + single DB-ready MappingResult.
// ---------------------------------------------------------------------------

export async function mapAndValidateCode(input: {
  code: string;
  description: string;
  category: string;
  specialty: string;
  contentBase: string;
  language: string;
  milestones: string;
  additionalInstructions?: string;
  checkAgainstLibrary: boolean;
  runId: string;
  stage: StageName;
}): Promise<MappingResult> {
  'use step';

  console.log('[pipeline] mapAndValidateCode', {
    code: input.code,
    checkAgainstLibrary: input.checkAgainstLibrary,
    stubbed: !hasMappingCreds(),
  });

  // Stub path: no MCP creds → return a canned "not covered" result. Lets the
  // workflow be exercised end-to-end without backend access.
  if (!hasMappingCreds()) {
    const stub: MappingOutput = {
      code: input.code,
      description: input.description,
      coverage: {
        inAMBOSS: false,
        coveredSections: [],
        generalNotes: 'stubbed (no AMBOSS MCP creds)',
        gaps: '',
        coverageLevel: 'none',
        coverageScore: 0,
      },
      suggestion: {
        improvement: '',
        sectionUpdates: [],
        newArticlesNeeded: [],
      },
    };
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'info',
      message: `Map (stub): ${input.code}`,
      metrics: {
        phase: 'map',
        completion: stub,
        model: 'stub',
      },
    });
    return {
      mapping: stub,
      attempts: 0,
      model: 'stub',
      invalidIds: [],
      unresolved: false,
    };
  }

  // Establish an MCP client once per code. Tools discovered from the server
  // are handed straight to `generateText` — the agent decides when to call
  // them during the response.
  const mcpUrl = env.AMBOSS_MCP_URL;
  const mcpToken = env.AMBOSS_MCP_TOKEN;
  if (!mcpUrl || !mcpToken) {
    throw new Error('AMBOSS_MCP_URL and AMBOSS_MCP_TOKEN must be set');
  }
  const mcp = await createMCPClient({
    transport: {
      type: 'http',
      url: mcpUrl,
      headers: { Authorization: `Bearer ${mcpToken}` },
    },
  });
  const allTools = await mcp.tools();
  // Expose only the three tools the n8n agent used. Keeps the model focused
  // and avoids the agent discovering prompts/resources that aren't expected.
  const toolNames = ['search_article_sections', 'get_article', 'get_sections'];
  const tools: Record<string, unknown> = {};
  for (const name of toolNames) {
    if (name in allTools) tools[name] = (allTools as Record<string, unknown>)[name];
  }

  const articleSet = input.checkAgainstLibrary
    ? await listAmbossArticleIds()
    : new Set<string>();
  const sectionSet = input.checkAgainstLibrary
    ? await listAmbossSectionIds()
    : new Set<string>();

  const system = composeSystem(input.milestones, input.additionalInstructions);
  const userBase = composeUser({
    specialty: input.specialty,
    code: input.code,
    codeCategory: input.category,
    description: input.description,
    contentBase: input.contentBase,
    language: input.language,
  });

  const ladder: Array<{ modelId: string; label: string }> = [
    { modelId: currentFlashModel(), label: 'flash-1' },
    { modelId: currentFlashModel(), label: 'flash-2' },
    { modelId: currentFlashModel(), label: 'flash-3' },
    { modelId: OPUS_MODEL, label: 'opus' },
  ];

  let cumulativeInvalid: string[] = [];
  let lastMapping: MappingOutput | null = null;
  let lastModel = ladder[0].modelId;
  let attempts = 0;
  let unresolved = false;

  const started = Date.now();
  try {
    for (const step of ladder) {
      attempts += 1;
      // Re-evaluate every iteration in case attempt 1 tripped the fallback flag.
      const modelId = step.modelId.startsWith('claude-')
        ? OPUS_MODEL
        : currentFlashModel();
      lastModel = modelId;

      // Skip the opus step if we don't have the Anthropic key; write through
      // the last flash output instead (unresolved).
      if (modelId === OPUS_MODEL && !env.ANTHROPIC_API_KEY) {
        unresolved = cumulativeInvalid.length > 0;
        break;
      }

      const userMessage =
        cumulativeInvalid.length === 0
          ? userBase
          : `${userBase}\n\n${correctionMessage(cumulativeInvalid)}`;

      await logEvent({
        runId: input.runId,
        stage: input.stage,
        level: 'info',
        message:
          cumulativeInvalid.length === 0
            ? `Map attempt ${attempts} (${step.label}): ${input.code}`
            : `Map attempt ${attempts} (${step.label}, ${cumulativeInvalid.length} invalid IDs): ${input.code}`,
        metrics: {
          phase: 'map',
          model: modelId,
          code: input.code,
          invalidIds: cumulativeInvalid,
        },
      });

      let result: {
        text: string;
        usage: ReturnType<typeof pickUsage>;
        mcp: { calls: number; toolNames: string[] };
      };
      try {
        result = await runAgentAttempt({ modelId, system, userMessage, tools });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const notFound =
          modelId === FLASH_PREVIEW_MODEL && /model|not.found|unsupported/i.test(msg);
        if (notFound && !flashFallbackTriggered) {
          flashFallbackTriggered = true;
          await logEvent({
            runId: input.runId,
            stage: input.stage,
            level: 'warn',
            message: `Flash preview unavailable — falling back to ${FLASH_FALLBACK_MODEL} for this run. (${msg})`,
            metrics: { phase: 'map', model: modelId },
          });
          attempts -= 1; // retry with fallback on next ladder iteration; but we
          // need to retry this same iteration — splice in a re-run:
          const retry = await runAgentAttempt({
            modelId: FLASH_FALLBACK_MODEL,
            system,
            userMessage,
            tools,
          });
          result = retry;
          lastModel = FLASH_FALLBACK_MODEL;
          attempts += 1;
        } else {
          throw e;
        }
      }

      const durationMs = Date.now() - started;
      let parsed: MappingOutput;
      try {
        parsed = MappingOutputSchema.parse(parseAgentJson(result.text));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logEvent({
          runId: input.runId,
          stage: input.stage,
          level: 'warn',
          message: `Map attempt ${attempts} (${step.label}) parse failed for ${input.code}: ${msg}`,
          metrics: { phase: 'map', model: lastModel, code: input.code, durationMs },
        });
        cumulativeInvalid = ['<malformed JSON>'];
        continue;
      }
      lastMapping = parsed;

      if (!input.checkAgainstLibrary) {
        // Toggle off: accept the first well-formed parse and stop.
        await logEvent({
          runId: input.runId,
          stage: input.stage,
          level: 'info',
          message: `Map done (no validation): ${input.code}`,
          metrics: {
            phase: 'map',
            model: lastModel,
            code: input.code,
            completion: parsed,
            durationMs,
            ...result.usage,
            costUsd: estimateCostUsd(lastModel, result.usage),
            attempts,
            mcpToolCalls: result.mcp.calls,
            mcpToolNames: result.mcp.toolNames,
          },
        });
        return {
          mapping: parsed,
          attempts,
          model: lastModel,
          invalidIds: [],
          unresolved: false,
        };
      }

      const invalid = validateMappingIds(parsed, articleSet, sectionSet);
      if (invalid.length === 0) {
        await logEvent({
          runId: input.runId,
          stage: input.stage,
          level: 'info',
          message: `Map validated: ${input.code}`,
          metrics: {
            phase: 'map',
            model: lastModel,
            code: input.code,
            completion: parsed,
            durationMs,
            ...result.usage,
            costUsd: estimateCostUsd(lastModel, result.usage),
            attempts,
            mcpToolCalls: result.mcp.calls,
            mcpToolNames: result.mcp.toolNames,
          },
        });
        return {
          mapping: parsed,
          attempts,
          model: lastModel,
          invalidIds: [],
          unresolved: false,
        };
      }

      cumulativeInvalid = invalid;
      // Continue the ladder; parse was valid but IDs aren't.
    }

    // Ladder exhausted. Write through the last mapping with unresolved flag.
    const durationMs = Date.now() - started;
    if (!lastMapping) {
      throw new Error('All attempts produced unparseable output');
    }
    await logEvent({
      runId: input.runId,
      stage: input.stage,
      level: 'warn',
      message: `Map unresolved after ${attempts} attempts: ${input.code} · ${cumulativeInvalid.length} invalid IDs`,
      metrics: {
        phase: 'map',
        model: lastModel,
        code: input.code,
        completion: lastMapping,
        invalidIds: cumulativeInvalid,
        durationMs,
        attempts,
      },
    });
    return {
      mapping: lastMapping,
      attempts,
      model: lastModel,
      invalidIds: cumulativeInvalid,
      unresolved: true,
    };
  } finally {
    try {
      await mcp.close();
    } catch {
      // non-fatal
    }
  }

  // Unreachable — here to satisfy control-flow analysis if the compiler
  // complains about `unresolved` set but never used (the ladder always
  // returns or throws).
  void unresolved;
}
