'use client';

import { H3, Stack } from '@amboss/design-system';
import { type ReactNode, useState } from 'react';

/**
 * Collapsible section for a pipeline phase (Preprocessing / Mapping /
 * Suggestion consolidation). Click the heading to toggle visibility of the
 * stage cards inside.
 */
export function PhaseGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Stack space="s">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <H3>{title}</H3>
      </button>
      {open ? children : null}
    </Stack>
  );
}
