'use client';

import { Badge, Inline, Select, Stack, Text } from '@amboss/design-system';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ConsolidatedSection } from '@/lib/types';
import { type Column, DataTable } from './data-table';

function kindBadge(row: ConsolidatedSection) {
  if (row.newSection) return <Badge text="new-section" color="blue" />;
  if (row.sectionUpdate) return <Badge text="section-update" color="purple" />;
  return <Badge text="—" color="gray" />;
}

const columns: Column<ConsolidatedSection>[] = [
  { key: 'kind', label: 'Kind', render: kindBadge, width: 140 },
  { key: 'article', label: 'Article', render: (r) => r.articleTitle ?? '—' },
  { key: 'section', label: 'Section', render: (r) => r.sectionName ?? '—' },
  { key: 'category', label: 'Category', render: (r) => r.category ?? '—' },
  {
    key: 'importance',
    label: 'Importance',
    render: (r) => r.overallImportance ?? '—',
    width: 100,
    align: 'right',
  },
  {
    key: 'coverage',
    label: 'Coverage',
    render: (r) => r.overallCoverage ?? '—',
    width: 100,
    align: 'right',
  },
  { key: 'editor', label: 'Editor', render: (r) => r.assignedEditor ?? '—', width: 140 },
  {
    key: 'justification',
    label: 'Justification',
    render: (r) => (
      <Text color="secondary" size="s">
        {r.justification ?? ''}
      </Text>
    ),
  },
];

export function SectionsView({ rows }: { rows: ConsolidatedSection[] }) {
  const params = useSearchParams();
  const [kind, setKind] = useState<string>(() => params.get('kind') ?? '');

  useEffect(() => {
    const p = new URLSearchParams();
    if (kind) p.set('kind', kind);
    const qs = p.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', next);
  }, [kind]);

  const filtered = useMemo(() => {
    if (kind === 'new') return rows.filter((r) => r.newSection === true);
    if (kind === 'update') return rows.filter((r) => r.sectionUpdate === true);
    return rows;
  }, [rows, kind]);

  return (
    <Stack space="m">
      <Inline space="s" vAlignItems="bottom">
        <div className="filter-cell">
          <Select
            name="kind"
            label="Kind"
            value={kind}
            options={[
              { value: '', label: 'All' },
              { value: 'new', label: 'New sections' },
              { value: 'update', label: 'Section updates' },
            ]}
            onChange={(e) => setKind(e.target.value)}
          />
        </div>
      </Inline>
      <Text color="secondary">
        {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} section
        suggestions (Section_Suggestions tab).
      </Text>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(r, i) => `${i}-${r.uniqueId ?? r.index ?? ''}`}
      />
    </Stack>
  );
}
