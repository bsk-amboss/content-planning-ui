'use client';

import { Link, Stack, Text } from '@amboss/design-system';
import type { CodeCategory } from '@/lib/types';
import { type Column, DataTable } from './data-table';

export function CategoriesView({ rows, slug }: { rows: CodeCategory[]; slug: string }) {
  const columns: Column<CodeCategory>[] = [
    {
      key: 'codeCategory',
      label: 'Category',
      render: (r) =>
        r.codeCategory ? (
          <Link
            href={`/planning/${encodeURIComponent(slug)}/codes?category=${encodeURIComponent(r.codeCategory)}`}
          >
            {r.codeCategory}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'source', label: 'Source', render: (r) => r.source ?? '—', width: 80 },
    {
      key: 'numCodes',
      label: 'Codes',
      render: (r) => r.numCodes ?? '—',
      width: 80,
      align: 'right',
    },
    {
      key: 'included',
      label: 'Included',
      render: (r) => r.numIncludedCodes ?? '—',
      width: 90,
      align: 'right',
    },
    {
      key: 'articles',
      label: 'Article codes',
      render: (r) => `${r.numIncludedArticleCodes ?? 0} / ${r.totalArticleCodes ?? 0}`,
      width: 130,
      align: 'right',
    },
    {
      key: 'sections',
      label: 'Section codes',
      render: (r) => `${r.numIncludedSectionCodes ?? 0} / ${r.totalSectionCodes ?? 0}`,
      width: 130,
      align: 'right',
    },
    {
      key: 'consolidated',
      label: 'Consolidated',
      render: (r) => (r.isConsolidated ? 'yes' : 'no'),
      width: 120,
    },
  ];

  return (
    <Stack space="m">
      <Text color="secondary">
        {rows.length} categories from Code_Categories. Click a category name to drill into
        its codes.
      </Text>
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r, i) => `${r.codeCategory ?? 'row'}-${i}`}
        emptyText="No categories found."
      />
    </Stack>
  );
}
