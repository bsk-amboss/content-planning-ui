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

export function CoverageBadge({ level }: { level: CoverageLevel | undefined }) {
  if (!level) return null;
  return <Badge text={level} color={COVERAGE_COLOR[level]} />;
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
