'use client';

import { H3, Stack } from '@amboss/design-system';
import type { ReactNode } from 'react';

export function PhaseGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack space="s">
      <H3>{title}</H3>
      {children}
    </Stack>
  );
}
