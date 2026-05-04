/**
 * Two-phase code extraction workflow (preprocessing stage).
 *
 * Mirrors the n8n pipeline at `n8n_workflows/code_extraction/`:
 *   1. Phase 1 — per PDF URL, identify module/chapter headings (Gemini call).
 *   2. Phase 2 — per (url, module), extract discrete medical items.
 *   3. Assemble `ab_<slug>_<nnnn>` codes, stage them, await user approval.
 *   4. On approval, promote staged rows into the canonical `codes` table.
 *
 * All Gemini calls are `"use step"` — a crash mid-run resumes with earlier
 * results served from the event log cache.
 */

import { createHook, FatalError } from 'workflow';
import { type ApprovalPayload, approvalToken } from '../lib/approval';
import {
  markStageAwaitingApproval,
  markStageCompleted,
  markStageFailed,
  markStageRunning,
  promoteExtractedCodesToCodes,
  updatePipelineRunStatus,
  writeExtractedCodes,
} from '../lib/db-writes';
import { aggregateStageMetrics, logEvent } from '../lib/events';
import { extractCodesForCategory, identifyModulesForUrl } from '../lib/gemini';
import type { ModelSpec, ProviderApiKeys } from '../lib/llm';
import { revalidateSpecialtyCache } from '../lib/revalidate';
import type { ContentInput } from '../lib/sources';
import { chunk } from '../lib/util';

const URL_CONCURRENCY = 10;
const CATEGORY_CONCURRENCY = 10;

export type ExtractCodesInput = {
  runId: string;
  specialtySlug: string;
  inputs: ContentInput[];
  identifyInstructions?: string;
  extractInstructions?: string;
  model: ModelSpec;
  apiKeys: ProviderApiKeys;
};

export async function extractCodesWorkflow(input: ExtractCodesInput) {
  'use workflow';

  console.log('[pipeline] extractCodesWorkflow start', {
    runId: input.runId,
    specialtySlug: input.specialtySlug,
    inputs: input.inputs.length,
  });

  try {
    await markStageRunning(input.runId, 'extract_codes');
    await logEvent({
      runId: input.runId,
      stage: 'extract_codes',
      level: 'info',
      message: `Run started for ${input.inputs.length} input(s)`,
    });

    // Phase 1: identify modules per (url, source), batched fan-out.
    const perUrlCategories: { url: string; source: string; category: string }[] = [];
    for (const batch of chunk(input.inputs, URL_CONCURRENCY)) {
      const results = await Promise.all(
        batch.map((inp) =>
          identifyModulesForUrl({
            url: inp.url,
            source: inp.source,
            additionalInstructions: input.identifyInstructions,
            specialtySlug: input.specialtySlug,
            runId: input.runId,
            stage: 'extract_codes',
            model: input.model,
            apiKeys: input.apiKeys,
          }),
        ),
      );
      results.forEach((mods, i) => {
        const { url, source } = batch[i];
        for (const m of mods)
          perUrlCategories.push({ url, source, category: m.category });
      });
    }
    await logEvent({
      runId: input.runId,
      stage: 'extract_codes',
      level: 'info',
      message: `Phase 1 complete: ${perUrlCategories.length} modules across ${input.inputs.length} input(s). Starting Phase 2.`,
    });

    // Phase 2: extract codes per (url, module, source), batched fan-out.
    // `consolidationCategory` is the Phase 1 module name — stamped on every
    // code produced from that module so downstream consolidation can fan out
    // per-module without re-deriving chunks.
    const extracted: {
      category: string;
      description: string;
      source: string;
      consolidationCategory: string;
    }[] = [];
    for (const batch of chunk(perUrlCategories, CATEGORY_CONCURRENCY)) {
      const results = await Promise.all(
        batch.map((p) =>
          extractCodesForCategory({
            url: p.url,
            source: p.source,
            category: p.category,
            specialtySlug: input.specialtySlug,
            additionalInstructions: input.extractInstructions,
            runId: input.runId,
            stage: 'extract_codes',
            model: input.model,
            apiKeys: input.apiKeys,
          }),
        ),
      );
      results.forEach((items, i) => {
        const { source, category: consolidationCategory } = batch[i];
        for (const it of items) extracted.push({ ...it, source, consolidationCategory });
      });
    }

    // Number codes per-source so each namespace starts at 0001.
    const perSourceCounts: Record<string, number> = {};
    const rawCodes = extracted.map((c) => {
      const n = (perSourceCounts[c.source] ?? 0) + 1;
      perSourceCounts[c.source] = n;
      return {
        code: `${c.source}_${input.specialtySlug}_${String(n).padStart(4, '0')}`,
        category: c.category,
        consolidationCategory: c.consolidationCategory,
        description: c.description,
        source: c.source,
      };
    });

    const { inserted } = await writeExtractedCodes(
      input.runId,
      input.specialtySlug,
      rawCodes,
    );
    const totals = await aggregateStageMetrics(input.runId, 'extract_codes');
    await markStageAwaitingApproval(input.runId, 'extract_codes', {
      extracted: inserted,
      pdfs: input.inputs.length,
      modules: perUrlCategories.length,
      apiCalls: totals.apiCalls,
      durationMs: totals.durationMs,
      computeMs: totals.computeMs,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      reasoningTokens: totals.reasoningTokens,
      costUsd: totals.costUsd,
    });
    await logEvent({
      runId: input.runId,
      stage: 'extract_codes',
      level: 'info',
      message: `Extraction complete. Awaiting approval — ${inserted} codes staged.`,
      metrics: {
        durationMs: totals.durationMs ?? undefined,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        reasoningTokens: totals.reasoningTokens,
        costUsd: totals.costUsd,
      },
    });

    using hook = createHook<ApprovalPayload>({
      token: approvalToken(input.runId, 'extract_codes'),
    });
    const approval = await hook;

    if (!approval.approved) {
      const reason = approval.note ? `: ${approval.note}` : '';
      await markStageFailed(input.runId, 'extract_codes', `Rejected${reason}`);
      throw new FatalError('Code extraction rejected');
    }

    await promoteExtractedCodesToCodes(input.runId, input.specialtySlug);
    await markStageCompleted(input.runId, 'extract_codes', approval.approvedBy);
    // Single-stage pipeline for now — finalize the run so the UI stops showing
    // it as active. When the preprocessing orchestrator + mapping/consolidation
    // workflows land, this will move to the top-level orchestrator instead.
    await updatePipelineRunStatus(input.runId, 'completed');
    // Invalidate codes/specialty caches so Overview + Codes tabs reflect the
    // promoted rows on the UI's next poll tick — workflows can't call
    // revalidateTag directly, so this hits the internal revalidate endpoint.
    await revalidateSpecialtyCache(input.specialtySlug);
  } catch (e) {
    if (e instanceof FatalError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    await markStageFailed(input.runId, 'extract_codes', msg);
    await updatePipelineRunStatus(input.runId, 'failed', msg);
    await revalidateSpecialtyCache(input.specialtySlug);
    throw e;
  }
}
