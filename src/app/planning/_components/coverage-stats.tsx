'use client';

import { Card, CardBox, Column, Columns, H2, Stack, Text } from '@amboss/design-system';

export interface StatItem {
  label: string;
  value: string | number;
  hint?: string;
}

export function CoverageStats({ stats }: { stats: StatItem[] }) {
  return (
    <Columns gap="m" vAlignItems="stretch">
      {stats.map((s) => (
        <Column key={s.label} size={[12, 6, 3]}>
          <div className="card-fill">
            <Card outlined>
              <CardBox>
                <Stack space="xs">
                  <Text color="secondary" size="s">
                    {s.label}
                  </Text>
                  <H2>{s.value}</H2>
                  {s.hint && (
                    <Text color="tertiary" size="s">
                      {s.hint}
                    </Text>
                  )}
                </Stack>
              </CardBox>
            </Card>
          </div>
        </Column>
      ))}
    </Columns>
  );
}
