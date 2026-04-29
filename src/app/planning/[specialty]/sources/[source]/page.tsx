import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { listSourceOntology } from '@/lib/data/sources';
import {
  ONTOLOGY_SOURCES,
  type OntologySource,
} from '@/lib/repositories/common/tab-names';
import { SourcesView } from '../../../_components/sources-view';
import { TableSkeleton } from '../../../_components/table-skeleton';
import { SourceTabs } from './source-tabs';

function isOntologySource(v: string): v is OntologySource {
  return (ONTOLOGY_SOURCES as readonly string[]).includes(v);
}

type Row = Record<string, unknown>;

export default async function SourcePage({
  params,
}: {
  params: Promise<{ specialty: string; source: string }>;
}) {
  const { specialty: slug, source } = await params;
  if (!isOntologySource(source)) notFound();
  return (
    <>
      <SourceTabs slug={slug} active={source} />
      <Suspense fallback={<TableSkeleton columns={5} rows={10} />}>
        <SourceData slug={slug} source={source} />
      </Suspense>
    </>
  );
}

async function SourceData({ slug, source }: { slug: string; source: OntologySource }) {
  const { rows } = await listSourceOntology(slug, source);
  return <SourcesView source={source} rows={rows as unknown as Row[]} />;
}
