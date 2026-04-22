'use client';

import { Stack, Text } from '@amboss/design-system';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Code } from '@/lib/repositories/types';
import {
  type CodeFilterOptions,
  type CodeFilterState,
  CodesFilter,
} from './codes-filter';
import { type Column, DataTable } from './data-table';
import { CoverageBadge } from './suggestion-badge';

function countSummary(code: Code) {
  const newArticles = code.newArticlesNeeded?.length ?? 0;
  const updates = code.existingArticleUpdates?.length ?? 0;
  return `${newArticles} new / ${updates} updates`;
}

const columns: Column<Code>[] = [
  { key: 'source', label: 'Source', render: (r) => r.source ?? '—', width: 80 },
  { key: 'code', label: 'Code', render: (r) => <code>{r.code}</code>, width: 180 },
  { key: 'description', label: 'Description', render: (r) => r.description ?? '' },
  { key: 'category', label: 'Category', render: (r) => r.category ?? '—' },
  {
    key: 'consolidationCategory',
    label: 'Consolidation category',
    render: (r) => r.consolidationCategory ?? '—',
  },
  {
    key: 'coverage',
    label: 'Coverage',
    render: (r) => <CoverageBadge level={r.coverageLevel} />,
    width: 140,
  },
  {
    key: 'depth',
    label: 'Depth',
    render: (r) => r.depthOfCoverage ?? '—',
    width: 60,
    align: 'right',
  },
  { key: 'suggestions', label: 'Suggestions', render: countSummary, width: 140 },
];

function uniqueStrings(values: (string | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return [...set].sort((a, b) => a.localeCompare(b));
}

const EMPTY_FILTERS: CodeFilterState = {
  source: '',
  category: '',
  consolidationCategory: '',
  coverage: '',
  inAmboss: '',
};

export function CodesView({ codes }: { codes: Code[] }) {
  const params = useSearchParams();

  const [filters, setFilters] = useState<CodeFilterState>(() => ({
    source: params.get('source') ?? '',
    category: params.get('category') ?? '',
    consolidationCategory: params.get('consolidationCategory') ?? '',
    coverage: params.get('coverage') ?? '',
    inAmboss: params.get('inAmboss') ?? '',
  }));

  // Sync URL without triggering a router transition (keeps the big DataTable
  // from re-rendering on every keystroke).
  useEffect(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const qs = p.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', next);
  }, [filters]);

  const setFilter = useCallback(
    (key: keyof CodeFilterState, value: string) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );
  const clear = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const options: CodeFilterOptions = useMemo(
    () => ({
      sources: uniqueStrings(codes.map((c) => c.source)),
      categories: uniqueStrings(codes.map((c) => c.category)),
      consolidationCategories: uniqueStrings(codes.map((c) => c.consolidationCategory)),
    }),
    [codes],
  );

  const filtered = useMemo(
    () =>
      codes.filter((c) => {
        if (filters.source && c.source !== filters.source) return false;
        if (filters.category && c.category !== filters.category) return false;
        if (
          filters.consolidationCategory &&
          c.consolidationCategory !== filters.consolidationCategory
        )
          return false;
        if (filters.coverage && c.coverageLevel !== filters.coverage) return false;
        if (filters.inAmboss === 'yes' && c.isInAMBOSS !== true) return false;
        if (filters.inAmboss === 'no' && c.isInAMBOSS !== false) return false;
        return true;
      }),
    [codes, filters],
  );

  return (
    <Stack space="m">
      <CodesFilter
        options={options}
        filters={filters}
        onChange={setFilter}
        onClear={clear}
      />
      <Text color="secondary">
        {filtered.length.toLocaleString()} of {codes.length.toLocaleString()} rows
        {filtered.length !== codes.length ? ' (filtered)' : ''} from Code_Amboss_Mapping.
      </Text>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(r, i) => `${r.code}-${i}`}
        emptyText="No codes match the current filters."
      />
    </Stack>
  );
}
