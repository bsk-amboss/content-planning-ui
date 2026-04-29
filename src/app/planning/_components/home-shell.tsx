'use client';

import { H1, H2, Stack, Text } from '@amboss/design-system';
import { AddSpecialtyForm } from './add-specialty-form';

export function HomeShell({
  specialtiesGrid,
  jumpTo,
}: {
  specialtiesGrid: React.ReactNode;
  jumpTo: React.ReactNode;
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
        {specialtiesGrid}
      </Stack>

      <Stack space="s">
        <H2>Add a specialty</H2>
        <Text color="secondary">
          Only identity is needed here. Provide the PDF URLs when you start a code or
          milestone extraction run.
        </Text>
        <AddSpecialtyForm />
      </Stack>

      {jumpTo}
    </Stack>
  );
}

export function SpecialtiesJumpToShell({ entry }: { entry: React.ReactNode }) {
  return (
    <Stack space="s">
      <H2>Jump to a specialty</H2>
      <Text color="secondary">Pick a specialty from the dropdown.</Text>
      {entry}
    </Stack>
  );
}
