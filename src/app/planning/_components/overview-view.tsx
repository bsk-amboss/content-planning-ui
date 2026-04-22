'use client';

import { Callout, Stack } from '@amboss/design-system';
import { CoverageStats, type StatItem } from './coverage-stats';

export function OverviewView({ stats, note }: { stats: StatItem[]; note?: string }) {
  return (
    <Stack space="l">
      <CoverageStats stats={stats} />
      {note && <Callout type="info" text={note} />}
    </Stack>
  );
}
