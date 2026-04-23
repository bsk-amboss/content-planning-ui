'use client';

import { Text } from '@amboss/design-system';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Column definition.
 *
 * - `render`  : what shows in each cell (can be arbitrary JSX).
 * - `accessor`: opt-in sortable/filterable value extractor. Without one, the
 *               column renders but has no sort affordance.
 * - `type`    : 'string' (default) | 'number' | 'date' | 'boolean'. Drives
 *               both the sort comparator and whether the numeric-filter
 *               popover is offered. `boolean` sorts true-before-false.
 * - `filterable`: only meaningful for `type: 'number'` — adds the ▽ icon
 *               in the header that opens an operator+value popover.
 */
export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
  accessor?: (row: T) => string | number | boolean | Date | null | undefined;
  type?: 'string' | 'number' | 'date' | 'boolean';
  filterable?: boolean;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

type NumOp = '>' | '>=' | '<' | '<=' | '=' | '!=';
type NumericFilter = { op: NumOp; value: number };

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
  const [sort, setSort] = useState<SortState>(null);
  const [numFilters, setNumFilters] = useState<Record<string, NumericFilter | null>>({});

  const filteredRows = useMemo(() => {
    const activeEntries = Object.entries(numFilters).filter(
      ([, f]) => f !== null && !Number.isNaN(f.value),
    ) as Array<[string, NumericFilter]>;
    if (activeEntries.length === 0) return rows;
    const bindings = activeEntries.map(([key, f]) => {
      const col = columns.find((c) => c.key === key);
      return { key, filter: f, col };
    });
    return rows.filter((row) => {
      for (const { filter, col } of bindings) {
        if (!col?.accessor) continue;
        const raw = col.accessor(row);
        if (raw === null || raw === undefined) return false;
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isNaN(n)) return false;
        if (!compareNum(n, filter.op, filter.value)) return false;
      }
      return true;
    });
  }, [rows, columns, numFilters]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.accessor) return filteredRows;
    const acc = col.accessor;
    const type = col.type ?? 'string';
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      // Nullish values always sort to the end regardless of direction so
      // toggling asc/desc doesn't make empty rows jump around.
      const aMissing = av === null || av === undefined || av === '';
      const bMissing = bv === null || bv === undefined || bv === '';
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      const cmp = compareTyped(av, bv, type);
      return cmp * factor;
    });
  }, [filteredRows, columns, sort]);

  const onSortToggle = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      // Third click → back to original order (no sort).
      return null;
    });
  };

  if (rows.length === 0) {
    return <Text color="secondary">{emptyText}</Text>;
  }
  const Body = sortedRows.length > VIRTUALIZE_THRESHOLD ? VirtualizedBody : PlainBody;

  return (
    <Body
      rows={sortedRows}
      columns={columns}
      getRowKey={getRowKey}
      sort={sort}
      onSortToggle={onSortToggle}
      numFilters={numFilters}
      onNumFilterChange={(key, next) =>
        setNumFilters((prev) => ({ ...prev, [key]: next }))
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Comparators.
// ---------------------------------------------------------------------------

function compareTyped(
  av: string | number | boolean | Date,
  bv: string | number | boolean | Date,
  type: 'string' | 'number' | 'date' | 'boolean',
): number {
  if (type === 'number') return (Number(av) || 0) - (Number(bv) || 0);
  if (type === 'date') {
    const a = av instanceof Date ? av.getTime() : new Date(String(av)).getTime();
    const b = bv instanceof Date ? bv.getTime() : new Date(String(bv)).getTime();
    return a - b;
  }
  if (type === 'boolean') {
    return (av ? 1 : 0) - (bv ? 1 : 0);
  }
  return String(av).localeCompare(String(bv), undefined, { numeric: true });
}

function compareNum(n: number, op: NumOp, v: number): boolean {
  switch (op) {
    case '>':
      return n > v;
    case '>=':
      return n >= v;
    case '<':
      return n < v;
    case '<=':
      return n <= v;
    case '=':
      return n === v;
    case '!=':
      return n !== v;
  }
}

// ---------------------------------------------------------------------------
// Header cell — shared by virtualized + plain paths. Sort toggle + optional
// numeric filter popover.
// ---------------------------------------------------------------------------

function HeaderCell<T>({
  column,
  sort,
  onSortToggle,
  numFilter,
  onNumFilterChange,
}: {
  column: Column<T>;
  sort: SortState;
  onSortToggle: (key: string) => void;
  numFilter: NumericFilter | null;
  onNumFilterChange: (key: string, next: NumericFilter | null) => void;
}) {
  const sortable = Boolean(column.accessor);
  const active = sort?.key === column.key ? sort.dir : null;
  const filterable = column.filterable === true && column.type === 'number';
  const hasActiveFilter = Boolean(numFilter);

  return (
    <th
      scope="col"
      style={{
        textAlign: column.align ?? 'left',
        padding: '10px 12px',
        borderBottom: '1px solid var(--ads-c-divider, rgba(0,0,0,0.1))',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        width: column.width,
        background: 'var(--ads-c-surface-subtle, rgba(0,0,0,0.02))',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          justifyContent:
            column.align === 'right'
              ? 'flex-end'
              : column.align === 'center'
                ? 'center'
                : 'flex-start',
        }}
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => onSortToggle(column.key)}
            title={
              active === 'asc'
                ? 'Sorted ascending — click for descending'
                : active === 'desc'
                  ? 'Sorted descending — click to restore original order'
                  : 'Click to sort ascending'
            }
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              fontWeight: 'inherit',
              color: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{column.label}</span>
            <span
              aria-hidden
              style={{
                fontSize: 11,
                color: active
                  ? 'inherit'
                  : 'var(--ads-c-text-secondary, rgba(0,0,0,0.35))',
              }}
            >
              {active === 'asc' ? '▲' : active === 'desc' ? '▼' : '⇅'}
            </span>
          </button>
        ) : (
          <span>{column.label}</span>
        )}
        {filterable ? (
          <NumericFilterMenu
            label={column.label}
            value={numFilter}
            active={hasActiveFilter}
            onChange={(next) => onNumFilterChange(column.key, next)}
          />
        ) : null}
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Numeric filter popover. Opens on click, dismisses on Escape / outside-click.
// ---------------------------------------------------------------------------

function NumericFilterMenu({
  label,
  value,
  active,
  onChange,
}: {
  label: string;
  value: NumericFilter | null;
  active: boolean;
  onChange: (next: NumericFilter | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [op, setOp] = useState<NumOp>(value?.op ?? '>=');
  const [numStr, setNumStr] = useState<string>(
    value?.value !== undefined ? String(value.value) : '',
  );
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setOp(value?.op ?? '>=');
    setNumStr(value?.value !== undefined ? String(value.value) : '');
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const apply = () => {
    const n = Number(numStr);
    if (Number.isNaN(n) || numStr.trim() === '') {
      onChange(null);
    } else {
      onChange({ op, value: n });
    }
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={`Filter ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={
          active && value
            ? `Filter active: ${op} ${value.value}`
            : 'Filter by numeric comparison'
        }
        style={{
          background: active
            ? 'var(--ads-c-surface-accent, rgba(0, 90, 180, 0.12))'
            : 'none',
          border: '1px solid transparent',
          borderRadius: 3,
          padding: '1px 4px',
          font: 'inherit',
          fontSize: 11,
          color: active ? 'var(--ads-c-text-accent, #0055aa)' : 'inherit',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ▽
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={`Filter ${label}`}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--ads-c-surface, white)',
            border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.15))',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: 10,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minWidth: 200,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={op}
              onChange={(e) => setOp(e.target.value as NumOp)}
              style={{
                padding: '4px 6px',
                border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.15))',
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              <option value=">=">≥</option>
              <option value=">">{'>'}</option>
              <option value="<=">≤</option>
              <option value="<">{'<'}</option>
              <option value="=">=</option>
              <option value="!=">≠</option>
            </select>
            <input
              type="number"
              value={numStr}
              onChange={(e) => setNumStr(e.target.value)}
              placeholder="value"
              style={{
                flex: 1,
                padding: '4px 6px',
                border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.15))',
                borderRadius: 4,
                fontSize: 13,
                minWidth: 0,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={clear}
              style={{
                background: 'none',
                border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.15))',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              style={{
                background: 'var(--ads-c-surface-accent-bold, #0055aa)',
                color: 'var(--ads-c-text-on-accent, white)',
                border: 'none',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body cells (shared).
// ---------------------------------------------------------------------------

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
// Shared props across plain + virtualized bodies.
// ---------------------------------------------------------------------------

type BodyProps<T> = {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T, index: number) => string;
  sort: SortState;
  onSortToggle: (key: string) => void;
  numFilters: Record<string, NumericFilter | null>;
  onNumFilterChange: (key: string, next: NumericFilter | null) => void;
};

function Header<T>({
  columns,
  sort,
  onSortToggle,
  numFilters,
  onNumFilterChange,
}: Omit<BodyProps<T>, 'rows' | 'getRowKey'>) {
  return (
    <thead>
      <tr>
        {columns.map((c) => (
          <HeaderCell
            key={c.key}
            column={c}
            sort={sort}
            onSortToggle={onSortToggle}
            numFilter={numFilters[c.key] ?? null}
            onNumFilterChange={onNumFilterChange}
          />
        ))}
      </tr>
    </thead>
  );
}

// ---------------------------------------------------------------------------
// Plain (non-virtualized) path.
// ---------------------------------------------------------------------------

function PlainBody<T>(props: BodyProps<T>) {
  const { rows, columns, getRowKey } = props;
  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.1))',
        borderRadius: 6,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <Header {...props} />
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
// Virtualized path (>200 rows).
// ---------------------------------------------------------------------------

function VirtualizedBody<T>(props: BodyProps<T>) {
  const { rows, columns, getRowKey } = props;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const items = virtualizer.getVirtualItems();
  const paddingTop = items.length > 0 ? items[0].start : 0;
  const paddingBottom =
    items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <div
      ref={parentRef}
      style={{
        maxHeight: '70vh',
        overflow: 'auto',
        border: '1px solid var(--ads-c-divider, rgba(0,0,0,0.1))',
        borderRadius: 6,
        contain: 'strict',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <Header {...props} />
        <tbody>
          {paddingTop > 0 ? (
            <tr style={{ height: paddingTop }}>
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {items.map((vi) => {
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
