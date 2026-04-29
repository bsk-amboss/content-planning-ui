'use client';

import { SkeletonLine } from './skeleton';

const ROW_KEYS = [
  'r0',
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
  'r6',
  'r7',
  'r8',
  'r9',
  'r10',
  'r11',
];

export function TableSkeleton({
  columns = 6,
  rows = 10,
}: {
  columns?: number;
  rows?: number;
}) {
  const colKeys = Array.from({ length: columns }, (_, i) => `c${i}`);
  const visibleRows = ROW_KEYS.slice(0, Math.min(rows, ROW_KEYS.length));
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <SkeletonLine width={220} height={14} />
        <SkeletonLine width={120} height={14} />
      </div>
      <div
        style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 6,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 12,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.03)',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {colKeys.map((k) => (
            <SkeletonLine key={k} width={'70%'} height={12} />
          ))}
        </div>
        {visibleRows.map((rk) => (
          <div
            key={rk}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {colKeys.map((ck) => (
              <SkeletonLine key={`${rk}-${ck}`} width={'85%'} height={14} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
