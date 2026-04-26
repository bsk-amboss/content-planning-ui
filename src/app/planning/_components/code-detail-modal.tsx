'use client';

import { Badge, Inline, Modal, Stack, Tabs, Text } from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Code } from '@/lib/repositories/types';
import { CoverageBadge, DepthBadge } from './suggestion-badge';

// The on-disk shape of these JSON columns is richer than the Zod type
// suggests (passthrough preserves the full object). We cast through these
// runtime types when rendering.
type CoveredSection = {
  articleTitle?: string;
  articleId?: string;
  sections?:
    | Record<string, string>
    | Array<{ sectionTitle?: string; sectionId?: string }>;
};

type SectionUpdate = {
  articleTitle?: string;
  articleId?: string;
  sections?: Array<{
    sectionTitle?: string;
    sectionId?: string;
    exists?: boolean;
    changes?: string;
    importance?: number;
  }>;
};

type NewArticleSuggestion = {
  articleTitle?: string;
  importance?: number;
};

function flattenSections(
  block: CoveredSection['sections'],
): Array<{ title: string; id: string }> {
  if (!block) return [];
  if (Array.isArray(block)) {
    return block
      .map((s) => ({ title: s.sectionTitle ?? '(unnamed)', id: s.sectionId ?? '' }))
      .filter((s) => s.title || s.id);
  }
  return Object.entries(block).map(([title, id]) => ({ title, id }));
}

/**
 * Which tab the modal should open on. Lets callers (the table cells) deep-link
 * into the relevant section without the user having to click around.
 * `coverage-articles` is the default.
 */
export type DetailTarget =
  | 'coverage-articles'
  | 'coverage-notes'
  | 'suggestion-improvements'
  | 'suggestion-updates'
  | 'suggestion-new-articles';

const TAB_ORDER: DetailTarget[] = [
  'coverage-articles',
  'coverage-notes',
  'suggestion-improvements',
  'suggestion-updates',
  'suggestion-new-articles',
];

function targetToIndex(target: DetailTarget | undefined): number {
  if (!target) return 0;
  const i = TAB_ORDER.indexOf(target);
  return i === -1 ? 0 : i;
}

export function CodeDetailModal({
  row,
  target,
  specialtySlug,
  canEdit,
  lockStatus,
  inFlight,
  onClose,
}: {
  row: Code | null;
  target?: DetailTarget;
  specialtySlug: string;
  canEdit: boolean;
  lockStatus: string | null;
  inFlight: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(targetToIndex(target));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The modal stays mounted across opens (row toggles between null and a
  // value), so re-align the tab whenever the caller's target/row changes.
  // Manual user clicks aren't overridden until the next open. Errors and
  // submit state also reset so a previous row's failure doesn't leak.
  const rowKey = row?.code;
  useEffect(() => {
    // rowKey is read here so a row change with an unchanged target still fires
    void rowKey;
    setActiveTab(targetToIndex(target));
    setError(null);
    setSubmitting(false);
  }, [target, rowKey]);

  if (!row) return null;

  // Map/Remap action wired into the modal footer. Mirrors the old in-table
  // RowActions: unmapped rows can always be mapped; remap of an already-
  // mapped row requires the consolidation gate to be open. While the row is
  // currently in flight from an active map_codes run, the action is locked.
  const isUnmapped = row.isInAMBOSS === undefined || row.isInAMBOSS === null;
  const actionEnabled = !inFlight && !submitting && (isUnmapped || canEdit);
  const actionLabel = inFlight
    ? 'Mapping…'
    : submitting
      ? isUnmapped
        ? 'Mapping…'
        : 'Remapping…'
      : isUnmapped
        ? 'Map'
        : 'Remap';
  const lockReason =
    !canEdit && !isUnmapped
      ? `Consolidation is active${lockStatus ? ` (${lockStatus})` : ''} — reset to re-enable`
      : null;

  const runMap = async () => {
    if (!actionEnabled) return;
    if (!isUnmapped) {
      const ok = window.confirm(
        `Clear the current mapping for "${row.code}" and re-run? The existing coverage, suggestions, and metadata will be overwritten.`,
      );
      if (!ok) return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const url = isUnmapped ? '/api/workflows/map-codes' : '/api/workflows/remap-code';
      const body = isUnmapped
        ? { specialtySlug, codes: [row.code], checkAgainstLibrary: true }
        : { specialtySlug, code: row.code, checkAgainstLibrary: true };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        setError(resBody?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const covered = (row.articlesWhereCoverageIs ?? []) as unknown as CoveredSection[];
  const updates = (row.existingArticleUpdates ?? []) as unknown as SectionUpdate[];
  const newArticles = (row.newArticlesNeeded ?? []) as unknown as NewArticleSuggestion[];
  const inAmboss = row.isInAMBOSS;
  const specialty = row.specialty ?? '';
  const category = row.category ?? '';

  return (
    <Modal
      header={row.description ?? row.code}
      subHeader={row.description ? row.code : undefined}
      size="l"
      isDismissible
      actionButton={{
        text: actionLabel,
        disabled: !actionEnabled,
        loading: submitting,
      }}
      secondaryButton={{ text: 'Close' }}
      onAction={(action) => {
        if (action === 'cancel') onClose();
        else if (action === 'action') runMap();
      }}
    >
      <Modal.Stack>
        <Stack space="m">
          <Inline space="s" vAlignItems="center">
            {specialty ? (
              <Text size="s" color="secondary">
                <Text as="span" size="s" weight="bold">
                  Specialty:
                </Text>{' '}
                {specialty}
              </Text>
            ) : null}
            {category ? (
              <Text size="s" color="secondary">
                <Text as="span" size="s" weight="bold">
                  Category:
                </Text>{' '}
                {category}
              </Text>
            ) : null}
          </Inline>

          <Inline space="s" vAlignItems="center">
            {inAmboss === true ? (
              <Badge text="In AMBOSS" color="green" />
            ) : inAmboss === false ? (
              <Badge text="Not in AMBOSS" color="red" />
            ) : (
              <Badge text="Unmapped" color="gray" />
            )}
            {row.coverageLevel ? <CoverageBadge level={row.coverageLevel} /> : null}
            {typeof row.depthOfCoverage === 'number' ? (
              <DepthBadge depth={row.depthOfCoverage} level={row.coverageLevel} />
            ) : null}
          </Inline>

          {error ? (
            <Text size="s" color="error">
              {error}
            </Text>
          ) : null}
          {lockReason && !error ? (
            <Text size="s" color="secondary">
              {lockReason}
            </Text>
          ) : null}

          <Tabs
            aria-label="Code detail sections"
            tabPanelId="code-detail-panel"
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            tabs={[
              { label: 'Coverage' },
              { label: 'Coverage Notes & Gaps' },
              { label: 'Improvements' },
              { label: 'Article Updates' },
              { label: 'New Articles' },
            ]}
          >
            <div>
              {activeTab === 0 ? (
                <CoverageArticlesPanel covered={covered} />
              ) : activeTab === 1 ? (
                <CoverageNotesPanel notes={row.notes ?? null} gaps={row.gaps ?? null} />
              ) : activeTab === 2 ? (
                <SuggestionImprovementsPanel improvements={row.improvements ?? null} />
              ) : activeTab === 3 ? (
                <SuggestionUpdatesPanel updates={updates} />
              ) : (
                <SuggestionNewArticlesPanel newArticles={newArticles} />
              )}
            </div>
          </Tabs>
        </Stack>
      </Modal.Stack>
    </Modal>
  );
}

function CoverageArticlesPanel({ covered }: { covered: CoveredSection[] }) {
  if (covered.length === 0) {
    return (
      <Text size="s" color="tertiary">
        No covered articles.
      </Text>
    );
  }
  return (
    <Stack space="s">
      {covered.map((art) => {
        const sections = flattenSections(art.sections);
        return (
          <div
            key={art.articleId ?? art.articleTitle ?? 'art'}
            style={{
              borderLeft: '2px solid var(--ads-c-divider, rgba(0,0,0,0.15))',
              paddingLeft: 10,
            }}
          >
            <Inline space="xxs" vAlignItems="center">
              <Text weight="bold">{art.articleTitle ?? '(untitled)'}</Text>
              {art.articleId ? (
                <Text size="s" color="tertiary">
                  {art.articleId}
                </Text>
              ) : null}
            </Inline>
            {sections.length > 0 ? (
              <Stack space="xxs">
                {sections.map((s) => (
                  <Inline key={s.id || s.title} space="xs" vAlignItems="center">
                    <Text size="s">{s.title}</Text>
                    {s.id ? (
                      <Text size="xs" color="tertiary">
                        {s.id}
                      </Text>
                    ) : null}
                  </Inline>
                ))}
              </Stack>
            ) : null}
          </div>
        );
      })}
    </Stack>
  );
}

function CoverageNotesPanel({
  notes,
  gaps,
}: {
  notes: string | null;
  gaps: string | null;
}) {
  if (!notes && !gaps) {
    return (
      <Text size="s" color="tertiary">
        No notes or gaps.
      </Text>
    );
  }
  return (
    <Stack space="m">
      {notes ? (
        <Stack space="xxs">
          <Text size="xs" weight="bold" color="secondary" transform="uppercase">
            Notes
          </Text>
          <Text>{notes}</Text>
        </Stack>
      ) : null}
      {gaps ? (
        <Stack space="xxs">
          <Text size="xs" weight="bold" color="secondary" transform="uppercase">
            Gaps
          </Text>
          <Text>{gaps}</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}

function SuggestionUpdatesPanel({ updates }: { updates: SectionUpdate[] }) {
  if (updates.length === 0) {
    return (
      <Text size="s" color="tertiary">
        No existing article updates.
      </Text>
    );
  }
  return (
    <Stack space="s">
      {updates.map((upd) => (
        <div
          key={upd.articleId ?? upd.articleTitle ?? 'upd'}
          style={{
            borderLeft: '2px solid rgb(217, 119, 6)',
            paddingLeft: 10,
          }}
        >
          <Inline space="xxs" vAlignItems="center">
            <Text weight="bold">{upd.articleTitle ?? '(untitled)'}</Text>
            {upd.articleId ? (
              <Text size="s" color="tertiary">
                {upd.articleId}
              </Text>
            ) : null}
          </Inline>
          <Stack space="xs">
            {(upd.sections ?? []).map((s) => (
              <Stack key={s.sectionId ?? s.sectionTitle ?? 'sec'} space="xxs">
                <Inline space="xxs" vAlignItems="center">
                  <Text size="s" weight="bold">
                    {s.sectionTitle ?? '(untitled section)'}
                  </Text>
                  {s.exists ? (
                    <Badge text="Section update" color="blue" />
                  ) : (
                    <Badge text="New section" color="green" />
                  )}
                  {typeof s.importance === 'number' ? (
                    <Badge text={`importance ${s.importance}/5`} color="yellow" />
                  ) : null}
                  {s.sectionId ? (
                    <Text size="xs" color="tertiary">
                      {s.sectionId}
                    </Text>
                  ) : null}
                </Inline>
                {s.changes ? <Text size="s">{s.changes}</Text> : null}
              </Stack>
            ))}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

function SuggestionNewArticlesPanel({
  newArticles,
}: {
  newArticles: NewArticleSuggestion[];
}) {
  if (newArticles.length === 0) {
    return (
      <Text size="s" color="tertiary">
        No new articles needed.
      </Text>
    );
  }
  return (
    <Stack space="xs">
      {newArticles.map((a) => (
        <Inline key={a.articleTitle ?? 'new'} space="xxs" vAlignItems="center">
          <Text weight="bold">{a.articleTitle ?? '(untitled)'}</Text>
          {typeof a.importance === 'number' ? (
            <Badge text={`importance ${a.importance}/5`} color="yellow" />
          ) : null}
        </Inline>
      ))}
    </Stack>
  );
}

function SuggestionImprovementsPanel({ improvements }: { improvements: string | null }) {
  if (!improvements) {
    return (
      <Text size="s" color="tertiary">
        No improvements suggested.
      </Text>
    );
  }
  return <Text>{improvements}</Text>;
}
