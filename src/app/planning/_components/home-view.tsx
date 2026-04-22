'use client';

import { Callout, Column, Columns, H1, H2, Stack, Text } from '@amboss/design-system';
import type { Specialty } from '@/lib/repositories/types';
import { SpecialtyCard } from './specialty-card';
import { SpecialtyEntry } from './specialty-entry';

export function HomeView({ specialties }: { specialties: Specialty[] }) {
  return (
    <Stack space="xl">
      <Stack space="s">
        <H1>Content Planner</H1>
        <Text color="secondary">
          Review coverage, mapped codes, and consolidation suggestions per specialty.
        </Text>
      </Stack>

      <Stack space="m">
        <H2>Specialties</H2>
        {specialties.length === 0 ? (
          <Callout
            type="info"
            text="No specialties registered yet. Set MAPPING_SHEET_IDS in .env.local or place anesthesiology_mapping.xlsx at the project root."
          />
        ) : (
          <Columns gap="m" vAlignItems="stretch">
            {specialties.map((s) => (
              <Column key={s.slug} size={[12, 6, 4]}>
                <SpecialtyCard specialty={s} />
              </Column>
            ))}
          </Columns>
        )}
      </Stack>

      {specialties.length > 0 && (
        <Stack space="s">
          <H2>Jump to a specialty</H2>
          <Text color="secondary">Pick a specialty from the dropdown.</Text>
          <SpecialtyEntry specialties={specialties} />
        </Stack>
      )}
    </Stack>
  );
}
