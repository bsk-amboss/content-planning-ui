'use client';

import { Tabs } from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import { ONTOLOGY_SOURCES, type OntologySource } from '@/lib/types';

export function SourceTabs({ slug, active }: { slug: string; active: OntologySource }) {
  const router = useRouter();
  const activeTab = Math.max(0, ONTOLOGY_SOURCES.indexOf(active));
  return (
    <Tabs
      aria-label={`${slug} ontology sources`}
      tabPanelId={`planning-${slug}-sources-panel`}
      activeTab={activeTab}
      tabs={ONTOLOGY_SOURCES.map((s) => ({ label: s }))}
      onTabSelect={(i: number) => {
        const next = ONTOLOGY_SOURCES[i];
        if (next) router.push(`/planning/${slug}/sources/${next}`);
      }}
    />
  );
}
