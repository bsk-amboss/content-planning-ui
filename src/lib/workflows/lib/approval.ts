/**
 * Deterministic token builders for stage-approval hooks.
 *
 * Workflows call `createHook({ token: approvalToken(runId, stage) })`; API
 * routes call `resumeHook(approvalToken(runId, stage), payload)` to release
 * the paused workflow without ever having to look up the hook directly.
 */

export type ApprovableStage = 'extract_codes' | 'extract_milestones';

export type ApprovalPayload = {
  approved: boolean;
  approvedBy?: string;
  note?: string;
};

export function approvalToken(runId: string, stage: ApprovableStage): string {
  return `approve:${runId}:${stage}`;
}
