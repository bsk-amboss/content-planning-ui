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
import { chunk } from '../lib/util';

const URL_CONCURRENCY = 10;
const CATEGORY_CONCURRENCY = 10;

export type ExtractCodesInput = {
  runId: string;
  specialtySlug: string;
  contentOutlineUrls: string[];
  systemPrompt: string;
};

export async function extractCodesWorkflow(input: ExtractCodesInput) {
  'use workflow';

  console.log('[pipeline] extractCodesWorkflow start', {
    runId: input.runId,
    specialtySlug: input.specialtySlug,
    pdfs: input.contentOutlineUrls.length,
  });

  try {
    await markStageRunning(input.runId, 'extract_codes');
    await logEvent({
      runId: input.runId,
      stage: 'extract_codes',
      level: 'info',
      message: `Run started for ${input.contentOutlineUrls.length} URL(s)`,
    });

    // Phase 1: identify modules per PDF URL, batched fan-out.
    const perUrlCategories: { url: string; category: string }[] = [];
    for (const batch of chunk(input.contentOutlineUrls, URL_CONCURRENCY)) {
      const results = await Promise.all(
        batch.map((url) =>
          identifyModulesForUrl({
            url,
            systemPrompt: input.systemPrompt,
            specialtySlug: input.specialtySlug,
            runId: input.runId,
            stage: 'extract_codes',
          }),
        ),
      );
      results.forEach((mods, i) => {
        for (const m of mods)
          perUrlCategories.push({ url: batch[i], category: m.category });
      });
    }
    await logEvent({
      runId: input.runId,
      stage: 'extract_codes',
      level: 'info',
      message: `Phase 1 complete: ${perUrlCategories.length} modules across ${input.contentOutlineUrls.length} URL(s). Starting Phase 2.`,
    });

    // Phase 2: extract codes per (url, module), batched fan-out.
    const extracted: { category: string; description: string }[] = [];
    for (const batch of chunk(perUrlCategories, CATEGORY_CONCURRENCY)) {
      const results = await Promise.all(
        batch.map((p) =>
          extractCodesForCategory({
            url: p.url,
            category: p.category,
            specialtySlug: input.specialtySlug,
            systemPrompt: input.systemPrompt,
            runId: input.runId,
            stage: 'extract_codes',
          }),
        ),
      );
      for (const items of results) extracted.push(...items);
    }

    const rawCodes = extracted.map((c, i) => ({
      code: `ab_${input.specialtySlug}_${String(i + 1).padStart(4, '0')}`,
      category: c.category,
      description: c.description,
      source: 'ab',
    }));

    const { inserted } = await writeExtractedCodes(
      input.runId,
      input.specialtySlug,
      rawCodes,
    );
    const totals = await aggregateStageMetrics(input.runId, 'extract_codes');
    await markStageAwaitingApproval(input.runId, 'extract_codes', {
      extracted: inserted,
      pdfs: input.contentOutlineUrls.length,
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
  } catch (e) {
    if (e instanceof FatalError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    await markStageFailed(input.runId, 'extract_codes', msg);
    await updatePipelineRunStatus(input.runId, 'failed', msg);
    throw e;
  }
}
