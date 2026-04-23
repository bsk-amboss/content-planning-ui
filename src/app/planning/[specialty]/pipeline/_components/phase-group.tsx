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
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 20,
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          {open ? '▾' : '▸'}
        </span>
        <H3>{title}</H3>
      </button>
      {open ? children : null}
    </Stack>
  );
}
