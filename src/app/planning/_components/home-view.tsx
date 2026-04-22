'use client';

import { Callout, Column, Columns, H1, H2, Stack, Text } from '@amboss/design-system';
import type { Phase } from '@/lib/phase';
import type { Specialty } from '@/lib/repositories/types';
import { AddSpecialtyForm } from './add-specialty-form';
import { SpecialtyCard } from './specialty-card';
import { SpecialtyEntry } from './specialty-entry';

export function HomeView({
  specialties,
  phases,
}: {
  specialties: Specialty[];
  phases: Record<string, Phase>;
}) {
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
            text="No specialties registered yet. Add one below, or run `npm run db:import-board -- <slug>` to import from the board mapping xlsx."
          />
        ) : (
          <Columns gap="m" vAlignItems="stretch">
            {specialties.map((s) => (
              <Column key={s.slug} size={[12, 6, 4]}>
                <SpecialtyCard specialty={s} phase={phases[s.slug]} />
              </Column>
            ))}
          </Columns>
        )}
      </Stack>

      <Stack space="s">
        <H2>Add a specialty</H2>
        <Text color="secondary">
          Only identity is needed here. Provide the PDF URLs when you start a code or
          milestone extraction run.
        </Text>
        <AddSpecialtyForm />
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
