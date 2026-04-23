/**
 * Milestone extraction workflow (preprocessing stage).
 *
 * Single Gemini call across every provided URL (via `url_context`) produces a
 * plain-text milestones blob, which the user approves before it lands on
 * `specialties.milestones`. Same durability + revalidate plumbing as
 * `extract-codes.ts`.
 */

import { createHook, FatalError } from 'workflow';
import { type ApprovalPayload, approvalToken } from '../lib/approval';
import {
  markStageAwaitingApproval,
  markStageCompleted,
  markStageFailed,
  markStageRunning,
  updatePipelineRunStatus,
  writeApprovedMilestones,
} from '../lib/db-writes';
import { aggregateStageMetrics, logEvent } from '../lib/events';
import { extractMilestonesForInputs } from '../lib/gemini';
import { revalidateSpecialtyCache } from '../lib/revalidate';
import type { ContentInput } from '../lib/sources';

export type ExtractMilestonesInput = {
  runId: string;
  specialtySlug: string;
  inputs: ContentInput[];
  milestonesInstructions?: string;
};

export async function extractMilestonesWorkflow(input: ExtractMilestonesInput) {
  'use workflow';

  console.log('[pipeline] extractMilestonesWorkflow start', {
    runId: input.runId,
    specialtySlug: input.specialtySlug,
    inputs: input.inputs.length,
  });

  try {
    await markStageRunning(input.runId, 'extract_milestones');
    await logEvent({
      runId: input.runId,
      stage: 'extract_milestones',
      level: 'info',
      message: `Run started for ${input.inputs.length} input(s)`,
    });

    const milestones = await extractMilestonesForInputs({
      inputs: input.inputs,
      specialtySlug: input.specialtySlug,
      additionalInstructions: input.milestonesInstructions,
      runId: input.runId,
      stage: 'extract_milestones',
    });

    const totals = await aggregateStageMetrics(input.runId, 'extract_milestones');
    await markStageAwaitingApproval(
      input.runId,
      'extract_milestones',
      {
        chars: milestones.length,
        inputs: input.inputs.length,
        apiCalls: totals.apiCalls,
        durationMs: totals.durationMs,
        computeMs: totals.computeMs,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        reasoningTokens: totals.reasoningTokens,
        costUsd: totals.costUsd,
      },
      { milestones },
    );
    await logEvent({
      runId: input.runId,
      stage: 'extract_milestones',
      level: 'info',
      message: `Extraction complete. Awaiting approval — ${milestones.length} chars drafted.`,
      metrics: {
        durationMs: totals.durationMs ?? undefined,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        reasoningTokens: totals.reasoningTokens,
        costUsd: totals.costUsd,
      },
    });

    using hook = createHook<ApprovalPayload>({
      token: approvalToken(input.runId, 'extract_milestones'),
    });
    const approval = await hook;

    if (!approval.approved) {
      const reason = approval.note ? `: ${approval.note}` : '';
      await markStageFailed(input.runId, 'extract_milestones', `Rejected${reason}`);
      throw new FatalError('Milestone extraction rejected');
    }

    await writeApprovedMilestones(input.specialtySlug, milestones);
    await markStageCompleted(input.runId, 'extract_milestones', approval.approvedBy);
    // Single-stage pipeline for now — finalize the run so the UI stops showing
    // it as active. The preprocessing orchestrator (Step 6) will later manage
    // this top-level transition instead.
    await updatePipelineRunStatus(input.runId, 'completed');
    await revalidateSpecialtyCache(input.specialtySlug);
  } catch (e) {
    if (e instanceof FatalError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    await markStageFailed(input.runId, 'extract_milestones', msg);
    await updatePipelineRunStatus(input.runId, 'failed', msg);
    await revalidateSpecialtyCache(input.specialtySlug);
    throw e;
  }
}
