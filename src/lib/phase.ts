/**
 * Pipeline phase derivation — shared between home-page specialty card,
 * specialty header badge, and the pipeline dashboard.
 *
 * A specialty's phase is derived from the status of its most recent
 * pipeline run. Callers pass the `pipeline_runs` row (or null when the
 * specialty has no runs yet).
 */

export type PipelineRunStatus =
  | 'running'
  | 'awaiting_preprocessing_approval'
  | 'mapping'
  | 'consolidating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type Phase =
  | 'not_started'
  | 'preprocessing'
  | 'mapping'
  | 'consolidating'
  | 'completed'
  | 'failed';

export function derivePhase(run: { status: string } | null | undefined): Phase {
  if (!run) return 'not_started';
  switch (run.status as PipelineRunStatus) {
    case 'running':
    case 'awaiting_preprocessing_approval':
      return 'preprocessing';
    case 'mapping':
      return 'mapping';
    case 'consolidating':
      return 'consolidating';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'not_started';
  }
}

export const PHASE_LABEL: Record<Phase, string> = {
  not_started: 'Not started',
  preprocessing: 'Preprocessing',
  mapping: 'Mapping',
  consolidating: 'Consolidating',
  completed: 'Completed',
  failed: 'Failed',
};

// DS Badge colors: 'green' | 'blue' | 'purple' | 'red' | 'yellow' | 'gray'
export const PHASE_COLOR: Record<
  Phase,
  'gray' | 'blue' | 'purple' | 'yellow' | 'green' | 'red'
> = {
  not_started: 'gray',
  preprocessing: 'blue',
  mapping: 'purple',
  consolidating: 'yellow',
  completed: 'green',
  failed: 'red',
};
