'use client';

import { Badge, Button, Card, CardBox, Inline, Stack, Text } from '@amboss/design-system';
import { useState } from 'react';
import type { PipelineEventRow, PipelineStageRow } from '@/lib/data/pipeline';
import type { StageName } from '@/lib/workflows/lib/db-writes';
import {
  type CodeSource,
  normalizeInputs,
  sourceLabel,
} from '@/lib/workflows/lib/sources';
import { ApproveButton } from './approve-button';
import { CancelButton } from './cancel-button';
import { ResetButton } from './reset-button';

type StageStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'completed'
  | 'failed'
  | 'skipped';

const STATUS_COLOR: Record<StageStatus, 'gray' | 'blue' | 'yellow' | 'green' | 'red'> = {
  pending: 'gray',
  running: 'blue',
  awaiting_approval: 'yellow',
  approved: 'green',
  completed: 'green',
  failed: 'red',
  skipped: 'gray',
};

const STATUS_LABEL: Record<StageStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
};

function summaryLine(summary: unknown): string | null {
  if (!summary || typeof summary !== 'object') return null;
  const s = summary as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof s.extracted === 'number') parts.push(`${s.extracted} extracted`);
  if (typeof s.modules === 'number') parts.push(`${s.modules} modules`);
  if (typeof s.pdfs === 'number') parts.push(`${s.pdfs} PDFs`);
  if (typeof s.chars === 'number') parts.push(`${s.chars} chars`);
  if (typeof s.inputs === 'number') parts.push(`${s.inputs} inputs`);
  if (typeof s.mapped === 'number') parts.push(`${s.mapped} mapped`);
  if (typeof s.escalations === 'number' && s.escalations > 0)
    parts.push(`${s.escalations} escalated`);
  if (typeof s.invalidIdsRemaining === 'number' && s.invalidIdsRemaining > 0)
    parts.push(`${s.invalidIdsRemaining} unresolved`);
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

function formatMs(ms: unknown): string {
  if (typeof ms !== 'number' || ms <= 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function formatTokens(n: unknown): string | null {
  if (typeof n !== 'number' || n <= 0) return null;
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

function formatCost(usd: unknown): string | null {
  if (typeof usd !== 'number') return null;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function metricsLine(summary: unknown): string | null {
  if (!summary || typeof summary !== 'object') return null;
  const s = summary as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof s.apiCalls === 'number') parts.push(`${s.apiCalls} API calls`);
  if (typeof s.durationMs === 'number') parts.push(formatMs(s.durationMs));
  const cost = formatCost(s.costUsd);
  if (cost) parts.push(cost);
  const total =
    (typeof s.inputTokens === 'number' ? s.inputTokens : 0) +
    (typeof s.outputTokens === 'number' ? s.outputTokens : 0) +
    (typeof s.reasoningTokens === 'number' ? s.reasoningTokens : 0);
  const tokens = formatTokens(total);
  if (tokens) parts.push(`${tokens} tokens`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const LEVEL_ICON: Record<string, string> = {
  info: '•',
  warn: '⚠',
  error: '✕',
};

const LEVEL_COLOR: Record<string, string> = {
  info: 'inherit',
  warn: 'var(--color-yellow-600, #a16207)',
  error: 'var(--color-red-600, #dc2626)',
};

function formatTs(ts: Date | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString();
}

/**
 * Browser for a sequence of per-call LLM completions. Each `events` entry has
 * its parsed output stored on `metrics.completion`. Arrows step through; a
 * counter shows N of M. Used for both Phase 1 (few) and Phase 2 (many) calls.
 */
function CompletionBrowser({
  events,
  renderLabel,
  renderItem,
  renderRaw,
  emptyLabel,
}: {
  events: PipelineEventRow[];
  renderLabel: (event: PipelineEventRow) => string;
  renderItem: (item: unknown, key: string) => React.ReactNode;
  /** Optional: override the per-event body with a single custom renderer
   *  (e.g. a JSON dump of the full completion). When provided, `renderItem`
   *  is ignored. */
  renderRaw?: (event: PipelineEventRow) => React.ReactNode;
  emptyLabel: string;
}) {
  const [index, setIndex] = useState(0);
  if (events.length === 0) {
    return <Text color="secondary">{emptyLabel}</Text>;
  }
  const clamped = Math.min(Math.max(0, index), events.length - 1);
  const current = events[clamped];
  const metrics = (current.metrics ?? {}) as Record<string, unknown>;
  const completion = Array.isArray(metrics.completion) ? metrics.completion : [];
  return (
    <Stack space="xxs">
      <Inline space="xs" vAlignItems="center">
        <Button
          type="button"
          variant="tertiary"
          disabled={clamped === 0}
          onClick={() => setIndex(clamped - 1)}
        >
          ◀
        </Button>
        <Text color="secondary">
          {clamped + 1} of {events.length}
        </Text>
        <Button
          type="button"
          variant="tertiary"
          disabled={clamped === events.length - 1}
          onClick={() => setIndex(clamped + 1)}
        >
          ▶
        </Button>
      </Inline>
      <Text color="secondary">{renderLabel(current)}</Text>
      <div
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          background: 'var(--color-gray-50, #f8f8f8)',
          border: '1px solid var(--color-gray-200, #e5e5e5)',
          borderRadius: 4,
          padding: 8,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {renderRaw
          ? renderRaw(current)
          : completion.map((item, i) => renderItem(item, `${current.id}-${i}`))}
      </div>
    </Stack>
  );
}

function CollapsibleSubsection({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  return (
    <Stack space="xxs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <span
          aria-hidden
          style={{ display: 'inline-block', width: 16, fontSize: 16, lineHeight: 1 }}
        >
          {open ? '▾' : '▸'}
        </span>
        <Text weight="bold">{title}</Text>
      </button>
      {open ? children : null}
    </Stack>
  );
}

function summaryPairs(summary: unknown): Array<[string, string]> {
  if (!summary || typeof summary !== 'object') return [];
  return Object.entries(summary as Record<string, unknown>).map(([k, v]) => [
    k,
    typeof v === 'object' ? JSON.stringify(v) : String(v),
  ]);
}

export function StageCard({
  title,
  description,
  stage,
  specialtySlug,
  stageName,
  runUrls,
  events,
  sources,
}: {
  title: string;
  description?: string;
  stage: PipelineStageRow | null;
  specialtySlug: string;
  stageName: StageName;
  runUrls?: unknown;
  events?: PipelineEventRow[];
  sources?: CodeSource[];
}) {
  const runInputs = normalizeInputs(runUrls);
  const status = (stage?.status ?? 'pending') as StageStatus;
  const summary = summaryLine(stage?.outputSummary);
  const metrics = metricsLine(stage?.outputSummary);
  const approvable =
    stage?.stage === 'extract_codes' ||
    stage?.stage === 'extract_milestones' ||
    stage?.stage === 'map_codes';
  const isTerminal =
    status === 'completed' || status === 'failed' || status === 'skipped';
  const isCancellable = status === 'running' || status === 'awaiting_approval';
  const [expanded, setExpanded] = useState(false);
  const evs = events ?? [];
  const hasDetails =
    stage !== null &&
    (stage.outputSummary ||
      stage.draftPayload ||
      stage.startedAt ||
      stage.errorMessage ||
      runInputs.length > 0 ||
      evs.length > 0);

  return (
    <div className="card-fill">
      <Card title={title} titleAs="h4" outlined>
        <CardBox>
          <Stack space="s">
            <Badge text={STATUS_LABEL[status]} color={STATUS_COLOR[status]} />
            {description ? <Text color="secondary">{description}</Text> : null}
            {summary ? <Text>{summary}</Text> : null}
            {metrics ? <Text color="secondary">{metrics}</Text> : null}
            {status === 'failed' && stage?.errorMessage ? (
              <Text color="secondary">{stage.errorMessage}</Text>
            ) : null}
            <Inline space="s" vAlignItems="center">
              {hasDetails ? (
                <Button variant="tertiary" onClick={() => setExpanded((x) => !x)}>
                  {expanded ? 'Hide details' : 'Show details'}
                </Button>
              ) : null}
              {status === 'awaiting_approval' && stage && approvable ? (
                <ApproveButton
                  runId={stage.runId}
                  specialtySlug={specialtySlug}
                  stage={
                    stage.stage as 'extract_codes' | 'extract_milestones' | 'map_codes'
                  }
                />
              ) : null}
              {isCancellable && stage ? (
                <CancelButton
                  runId={stage.runId}
                  specialtySlug={specialtySlug}
                  stage={stageName}
                />
              ) : null}
              {isTerminal && stage ? (
                <ResetButton
                  runId={stage.runId}
                  specialtySlug={specialtySlug}
                  stage={stageName}
                />
              ) : null}
            </Inline>
            {expanded && stage ? (
              <Stack space="xs">
                {formatTs(stage.startedAt) ? (
                  <Text color="secondary">Started: {formatTs(stage.startedAt)}</Text>
                ) : null}
                {formatTs(stage.finishedAt) ? (
                  <Text color="secondary">Finished: {formatTs(stage.finishedAt)}</Text>
                ) : null}
                {formatTs(stage.approvedAt) ? (
                  <Text color="secondary">
                    Approved: {formatTs(stage.approvedAt)}
                    {stage.approvedBy ? ` by ${stage.approvedBy}` : ''}
                  </Text>
                ) : null}
                {(() => {
                  // Milestones stage: single plain-text output. Read from the
                  // most recent milestones-phase event's completion string, or
                  // (as a fallback) from draftPayload.milestones which persists
                  // through approval.
                  if (stage.stage === 'extract_milestones') {
                    const milestonesEvent = [...evs]
                      .reverse()
                      .find(
                        (e) =>
                          (e.metrics as { phase?: string } | null)?.phase ===
                            'milestones' &&
                          typeof (e.metrics as { completion?: unknown } | null)
                            ?.completion === 'string',
                      );
                    const fromEvent =
                      (milestonesEvent?.metrics as { completion?: string } | null)
                        ?.completion ?? null;
                    const fromDraft =
                      (stage.draftPayload as { milestones?: string } | null)
                        ?.milestones ?? null;
                    const text = fromEvent ?? fromDraft;
                    if (!text) return null;
                    return (
                      <CollapsibleSubsection title="Output">
                        <pre
                          style={{
                            background: 'var(--color-gray-50, #f8f8f8)',
                            border: '1px solid var(--color-gray-200, #e5e5e5)',
                            borderRadius: 4,
                            padding: 8,
                            fontSize: 12,
                            lineHeight: 1.5,
                            maxHeight: 480,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            margin: 0,
                          }}
                        >
                          {text}
                        </pre>
                      </CollapsibleSubsection>
                    );
                  }
                  if (stage.stage === 'map_codes') {
                    // Mapping: browse per-code completions. Each event carries
                    // the per-code metadata (attempts, model, invalidIds) +
                    // the full parsed mapping in `completion`.
                    const mapEvents = evs.filter(
                      (e) =>
                        (e.metrics as { phase?: string } | null)?.phase === 'map' &&
                        (e.metrics as { completion?: unknown } | null)?.completion,
                    );
                    if (mapEvents.length === 0) return null;
                    return (
                      <CollapsibleSubsection title="Output">
                        <CompletionBrowser
                          events={mapEvents}
                          emptyLabel="No mapping completions yet."
                          renderLabel={(e) => {
                            const m = (e.metrics ?? {}) as Record<string, unknown>;
                            const code = typeof m.code === 'string' ? m.code : '';
                            const model = typeof m.model === 'string' ? m.model : '';
                            const attempts =
                              typeof m.attempts === 'number' ? m.attempts : null;
                            const invalidCount = Array.isArray(m.invalidIds)
                              ? m.invalidIds.length
                              : 0;
                            const tail = [
                              model,
                              attempts !== null ? `${attempts} attempts` : null,
                              invalidCount > 0 ? `${invalidCount} invalid IDs` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ');
                            return `${code}${tail ? ` — ${tail}` : ''}`;
                          }}
                          renderItem={() => null}
                          renderRaw={(event) => {
                            const m = (event.metrics ?? {}) as Record<string, unknown>;
                            const mapping = m.completion;
                            return (
                              <pre
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {JSON.stringify(mapping, null, 2)}
                              </pre>
                            );
                          }}
                        />
                      </CollapsibleSubsection>
                    );
                  }
                  const phase1 = evs.filter(
                    (e) => (e.metrics as { phase?: string } | null)?.phase === 'identify',
                  );
                  const phase2 = evs.filter(
                    (e) => (e.metrics as { phase?: string } | null)?.phase === 'extract',
                  );
                  if (phase1.length === 0 && phase2.length === 0) return null;
                  return (
                    <CollapsibleSubsection title="Output">
                      <Stack space="s">
                        <Stack space="xxs">
                          <Text weight="bold">Phase 1 — Identify modules</Text>
                          <CompletionBrowser
                            events={phase1}
                            emptyLabel="No Phase 1 completions yet."
                            renderLabel={(e) => {
                              const m = (e.metrics ?? {}) as Record<string, unknown>;
                              return typeof m.url === 'string' ? m.url : '';
                            }}
                            renderItem={(item, key) => {
                              const obj = (item ?? {}) as { category?: string };
                              return (
                                <div key={key} style={{ padding: '2px 0' }}>
                                  {obj.category ?? String(item)}
                                </div>
                              );
                            }}
                          />
                        </Stack>
                        <Stack space="xxs">
                          <Text weight="bold">Phase 2 — Extract codes</Text>
                          <CompletionBrowser
                            events={phase2}
                            emptyLabel="No Phase 2 completions yet."
                            renderLabel={(e) => {
                              const m = (e.metrics ?? {}) as Record<string, unknown>;
                              const url = typeof m.url === 'string' ? m.url : '';
                              const cat =
                                typeof m.category === 'string' ? m.category : '';
                              return cat ? `${url} · ${cat}` : url;
                            }}
                            renderItem={(item, key) => {
                              const obj = (item ?? {}) as {
                                category?: string;
                                description?: string;
                              };
                              return (
                                <div
                                  key={key}
                                  style={{
                                    padding: '4px 0',
                                    borderBottom:
                                      '1px solid var(--color-gray-200, #e5e5e5)',
                                  }}
                                >
                                  <div style={{ fontWeight: 'bold' }}>
                                    {obj.description ?? ''}
                                  </div>
                                  <div style={{ color: '#737373' }}>
                                    {obj.category ?? ''}
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </Stack>
                      </Stack>
                    </CollapsibleSubsection>
                  );
                })()}
                {summaryPairs(stage.outputSummary).length > 0 ? (
                  <CollapsibleSubsection title="Metadata">
                    {summaryPairs(stage.outputSummary).map(([k, v]) => (
                      <Text key={k} color="secondary">
                        {k}: {v}
                      </Text>
                    ))}
                  </CollapsibleSubsection>
                ) : null}
                {summaryPairs(stage.draftPayload).length > 0 ? (
                  <CollapsibleSubsection title="Draft">
                    <pre
                      style={{
                        background: 'var(--color-gray-50, #f5f5f5)',
                        padding: 8,
                        fontSize: 12,
                        overflow: 'auto',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(stage.draftPayload, null, 2)}
                    </pre>
                  </CollapsibleSubsection>
                ) : null}
                {runInputs.length > 0 ? (
                  <CollapsibleSubsection title="Inputs">
                    {runInputs.map((inp) => (
                      <Text key={inp.url} color="secondary">
                        [{sourceLabel(inp.source, sources)}] {inp.url}
                      </Text>
                    ))}
                  </CollapsibleSubsection>
                ) : null}
                {evs.length > 0 ? (
                  <CollapsibleSubsection title={`Log · ${evs.length} events`}>
                    <div
                      style={{
                        maxHeight: 320,
                        overflowY: 'auto',
                        background: 'var(--color-gray-50, #f8f8f8)',
                        border: '1px solid var(--color-gray-200, #e5e5e5)',
                        borderRadius: 4,
                        padding: 8,
                        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {evs.map((e) => {
                        const m = (e.metrics ?? {}) as Record<string, unknown>;
                        const ts = new Date(e.createdAt).toLocaleTimeString();
                        const metaParts: string[] = [];
                        if (typeof m.durationMs === 'number') {
                          metaParts.push(formatMs(m.durationMs));
                        }
                        const cost = formatCost(m.costUsd);
                        if (cost) metaParts.push(cost);
                        const total =
                          (typeof m.inputTokens === 'number' ? m.inputTokens : 0) +
                          (typeof m.outputTokens === 'number' ? m.outputTokens : 0) +
                          (typeof m.reasoningTokens === 'number' ? m.reasoningTokens : 0);
                        const tokens = formatTokens(total);
                        if (tokens) metaParts.push(`${tokens} tokens`);
                        return (
                          <div
                            key={e.id}
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            <span style={{ color: 'var(--color-gray-500, #737373)' }}>
                              [{ts}]
                            </span>{' '}
                            <span style={{ color: LEVEL_COLOR[e.level] ?? 'inherit' }}>
                              {LEVEL_ICON[e.level] ?? '•'}
                            </span>{' '}
                            {e.message}
                            {metaParts.length > 0 ? (
                              <span style={{ color: 'var(--color-gray-500, #737373)' }}>
                                {' '}
                                · {metaParts.join(' · ')}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleSubsection>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </CardBox>
      </Card>
    </div>
  );
}
