'use client';

import { Text } from '@amboss/design-system';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
}

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
  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.1))',
        borderRadius: 6,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
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
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={getRowKey(row, i)}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
