'use client';

import { Callout, H2, Stack, Text } from '@amboss/design-system';
import type {
  ArticleUpdateSuggestion,
  ConsolidatedArticle,
  NewArticleSuggestion,
} from '@/lib/types';
import { type Column, DataTable } from './data-table';

const consolidatedColumns: Column<ConsolidatedArticle>[] = [
  { key: 'title', label: 'Title', render: (r) => r.articleTitle ?? '—' },
  { key: 'type', label: 'Type', render: (r) => r.articleType ?? '—', width: 160 },
  { key: 'category', label: 'Category', render: (r) => r.category ?? '—' },
  {
    key: 'numCodes',
    label: 'Codes',
    render: (r) => r.numCodes ?? '—',
    width: 80,
    align: 'right',
  },
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

const newColumns: Column<NewArticleSuggestion>[] = [
  { key: 'title', label: 'Title', render: (r) => r.articleTitle ?? '—' },
  { key: 'type', label: 'Type', render: (r) => r.articleType ?? '—', width: 160 },
  {
    key: 'importance',
    label: 'Importance',
    render: (r) => r.overallImportance ?? '—',
    width: 100,
    align: 'right',
  },
  {
    key: 'coverage',
    label: 'Existing AMBOSS',
    render: (r) => r.existingAmbossCoverage ?? '—',
    width: 140,
  },
  { key: 'editor', label: 'Editor', render: (r) => r.assignedEditor ?? '—', width: 140 },
  { key: 'verdict', label: 'Verdict', render: (r) => r.verdict ?? '—', width: 120 },
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

export function ArticlesView({
  consolidated,
  newOnes,
  updates,
}: {
  consolidated: ConsolidatedArticle[];
  newOnes: NewArticleSuggestion[];
  updates: ArticleUpdateSuggestion[];
}) {
  return (
    <Stack space="xl">
      <Stack space="m">
        <H2>Consolidated articles</H2>
        <Text color="secondary">
          {consolidated.length} deduped article suggestions post-consolidation.
        </Text>
        <DataTable
          rows={consolidated}
          columns={consolidatedColumns}
          getRowKey={(r, i) => `${i}-${r.index ?? ''}`}
        />
      </Stack>

      <Stack space="m">
        <H2>New article suggestions</H2>
        <Text color="secondary">
          {newOnes.length} editor-facing suggestions for new articles.
        </Text>
        <DataTable
          rows={newOnes}
          columns={newColumns}
          getRowKey={(r, i) => `${i}-${r.index ?? ''}`}
        />
      </Stack>

      <Stack space="m">
        <H2>Article update suggestions</H2>
        {updates.length === 0 ? (
          <Callout
            type="info"
            text="Article_Update_Suggestions is empty for this specialty."
          />
        ) : (
          <DataTable
            rows={updates}
            columns={newColumns}
            getRowKey={(r, i) => `${i}-${r.index ?? ''}`}
          />
        )}
      </Stack>
    </Stack>
  );
}
