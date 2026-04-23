'use client';

import { Text } from '@amboss/design-system';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useRef } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
}

/**
 * Rows above this count render through `useVirtualizer`. Below it, the plain
 * `<table>` path stays — virtualization has ~1ms of per-frame fixed overhead
 * (measuring, translateY math) that only pays off on big datasets. The
 * specialties, categories, articles, and sections tables all sit under this
 * threshold and avoid the extra machinery entirely.
 */
const VIRTUALIZE_THRESHOLD = 200;

export function DataTable<T>({
  rows,
  columns,
  emptyText = 'No rows to display.',
  getRowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyText?: string;
  getRowKey: (row: T, index: number) => string;
}) {
  if (rows.length === 0) {
    return <Text color="secondary">{emptyText}</Text>;
  }
  return rows.length > VIRTUALIZE_THRESHOLD ? (
    <VirtualizedTable rows={rows} columns={columns} getRowKey={getRowKey} />
  ) : (
    <PlainTable rows={rows} columns={columns} getRowKey={getRowKey} />
  );
}

// ---------------------------------------------------------------------------
// Shared column markup.
// ---------------------------------------------------------------------------

function TableHead<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c) => (
          <th
            key={c.key}
            style={{
              textAlign: c.align ?? 'left',
              padding: '10px 12px',
              borderBottom: '1px solid var(--ads-c-divider, rgba(0,0,0,0.1))',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              width: c.width,
              background: 'var(--ads-c-surface-subtle, rgba(0,0,0,0.02))',
              // Sticky keeps the header in view while the virtualized body
              // scrolls beneath. Harmless on the plain path too.
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableCells<T>({ row, columns }: { row: T; columns: Column<T>[] }) {
  return (
    <>
      {columns.map((c) => (
        <td
          key={c.key}
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--ads-c-divider, rgba(0,0,0,0.05))',
            verticalAlign: 'top',
            textAlign: c.align ?? 'left',
            maxWidth: 360,
          }}
        >
          {c.render(row)}
        </td>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Plain (non-virtualized) path — unchanged from the pre-virtualization
// version aside from the extracted thead/tbody helpers.
// ---------------------------------------------------------------------------

function PlainTable<T>({
  rows,
  columns,
  getRowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T, index: number) => string;
}) {
  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.1))',
        borderRadius: 6,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <TableHead columns={columns} />
        <tbody>
          {rows.map((row, i) => (
            <tr key={getRowKey(row, i)}>
              <TableCells row={row} columns={columns} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Virtualized path — only the rows in the viewport (plus a small overscan)
// live in the DOM. Dynamic row heights via `measureElement` preserve the
// current multi-line description behavior.
// ---------------------------------------------------------------------------

function VirtualizedTable<T>({
  rows,
  columns,
  getRowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T, index: number) => string;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
    // Measure each rendered `<tr>` so multi-line descriptions (which wrap to
    // arbitrary heights) keep the scroll math accurate. The ref below is
    // attached by the mapped rows.
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <div
      ref={parentRef}
      style={{
        // Fixed viewport lets the inner virtualizer scroll instead of the
        // page. 70vh leaves room for the filter bar + page chrome above.
        maxHeight: '70vh',
        overflow: 'auto',
        border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.1))',
        borderRadius: 6,
        // Hint to the browser that this region is an isolated painting
        // context. Helps the compositor and prevents off-screen rows from
        // forcing layout.
        contain: 'strict',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
        }}
      >
        <TableHead columns={columns} />
        <tbody>
          {paddingTop > 0 ? (
            <tr style={{ height: paddingTop }}>
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {virtualItems.map((vi) => {
            const row = rows[vi.index];
            return (
              <tr
                key={getRowKey(row, vi.index)}
                data-index={vi.index}
                ref={virtualizer.measureElement}
              >
                <TableCells row={row} columns={columns} />
              </tr>
            );
          })}
          {paddingBottom > 0 ? (
            <tr style={{ height: paddingBottom }}>
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
