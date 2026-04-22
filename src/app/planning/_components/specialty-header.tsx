'use client';

import { Badge, Callout, H1, Inline, Stack, Text } from '@amboss/design-system';
import type { Backend } from '@/lib/data/specialties';
import { PHASE_COLOR, PHASE_LABEL, type Phase } from '@/lib/phase';
import type { Specialty } from '@/lib/repositories/types';
import { Breadcrumbs } from './breadcrumbs';
import { ChangeSpecialtyButton } from './change-specialty-button';
import { RefreshButton } from './refresh-button';
import { SpecialtyTabs } from './specialty-tabs';

const BACKEND_LABEL: Record<
  Backend,
  { text: string; color: 'green' | 'blue' | 'purple' }
> = {
  postgres: { text: 'Neon Postgres', color: 'purple' },
  sheets: { text: 'Google Sheets', color: 'green' },
  xlsx: { text: 'Local fixture', color: 'blue' },
};

export function SpecialtyHeader({
  specialty,
  backend,
  phase,
}: {
  specialty: Specialty;
  backend: Backend;
  phase: Phase;
}) {
  const badge = BACKEND_LABEL[backend];
  return (
    <Stack space="l">
      <Breadcrumbs
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Specialty Dashboard', href: '/planning' },
          { label: specialty.name },
        ]}
      />
      <Inline space="m" vAlignItems="center">
        <H1>{specialty.name}</H1>
        <Badge text={badge.text} color={badge.color} />
        <Badge text={PHASE_LABEL[phase]} color={PHASE_COLOR[phase]} />
        <ChangeSpecialtyButton />
        <RefreshButton slug={specialty.slug} />
      </Inline>
      <Text color="secondary">
        Slug: <code>{specialty.slug}</code>
        {backend === 'postgres' && specialty.source !== 'sheets' ? (
          <>
            {' '}
            · seeded from {specialty.source === 'xlsx' ? 'local xlsx' : specialty.source}
          </>
        ) : null}
      </Text>
      <SpecialtyTabs slug={specialty.slug} />
    </Stack>
  );
}

export function NotConfiguredView({ slug }: { slug: string }) {
  return (
    <Stack space="l">
      <Breadcrumbs
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Specialty Dashboard', href: '/planning' },
          { label: slug },
        ]}
      />
      <H1>{slug}</H1>
      <Callout
        type="info"
        text={`"${slug}" is not configured. Add a sheet ID under MAPPING_SHEET_IDS in .env.local (e.g. {"${slug}":"<google-sheet-id>"}) or register a local xlsx via LOCAL_XLSX_FIXTURES, then restart the dev server.`}
      />
    </Stack>
  );
}
