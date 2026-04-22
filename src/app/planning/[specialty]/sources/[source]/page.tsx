import { notFound } from 'next/navigation';
import { listSourceOntology } from '@/lib/data/sources';
import {
  ONTOLOGY_SOURCES,
  type OntologySource,
} from '@/lib/repositories/common/tab-names';
import { SourcesView } from '../../../_components/sources-view';
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

  const { rows } = await listSourceOntology(slug, source);
  return (
    <>
      <SourceTabs slug={slug} active={source} />
      <SourcesView source={source} rows={rows as unknown as Row[]} />
    </>
  );
}
