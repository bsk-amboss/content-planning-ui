'use client';

import { Badge } from '@amboss/design-system';
import type { CoverageLevel } from '@/lib/repositories/types';

export type BadgeColor =
  | 'green'
  | 'blue'
  | 'yellow'
  | 'brand'
  | 'purple'
  | 'red'
  | 'gray';

const COVERAGE_COLOR: Record<CoverageLevel, BadgeColor> = {
  none: 'red',
  student: 'yellow',
  'early-resident': 'brand',
  'advanced-resident': 'blue',
  attending: 'green',
  specialist: 'purple',
};

export function coverageBadgeColor(
  level: CoverageLevel | undefined,
): BadgeColor | undefined {
  return level ? COVERAGE_COLOR[level] : undefined;
}

export function CoverageBadge({ level }: { level: CoverageLevel | undefined }) {
  if (!level) return null;
  return <Badge text={level} color={COVERAGE_COLOR[level]} />;
}

/**
 * Depth chip that piggy-backs on the coverage level for color so the two cells
 * read as one ladder. Falls back to gray when the level is missing — the depth
 * is still meaningful on its own (just less interpretable without a level).
 */
export function DepthBadge({
  depth,
  level,
}: {
  depth: number | null | undefined;
  level: CoverageLevel | undefined;
}) {
  if (depth === null || depth === undefined) return null;
  return <Badge text={`Depth ${depth}`} color={coverageBadgeColor(level) ?? 'gray'} />;
}

export function SuggestionKindBadge({
  kind,
}: {
  kind: 'new-article' | 'new-section' | 'section-update';
}) {
  const colors: Record<typeof kind, BadgeColor> = {
    'new-article': 'green',
    'new-section': 'blue',
    'section-update': 'purple',
  };
  return <Badge text={kind} color={colors[kind]} />;
}
