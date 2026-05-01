'use client';

import { Stack } from '@amboss/design-system';
import { CoverageStats, type StatItem } from './coverage-stats';

export function OverviewView({ stats }: { stats: StatItem[] }) {
  return (
    <Stack space="l">
      <CoverageStats stats={stats} />
    </Stack>
  );
}
