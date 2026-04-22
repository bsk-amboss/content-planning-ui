'use client';

import { Badge, Card, CardBox, Stack, Text } from '@amboss/design-system';
import NextLink from 'next/link';
import type { Specialty } from '@/lib/repositories/types';

export function SpecialtyCard({
  specialty,
  meta,
}: {
  specialty: Specialty;
  meta?: { codes?: number; consolidatedArticles?: number; consolidatedSections?: number };
}) {
  const href = `/planning/${specialty.slug}`;
  return (
    <div className="card-fill">
      <NextLink href={href} style={{ textDecoration: 'none' }}>
        <Card title={specialty.name} titleAs="h3">
          <CardBox>
            <Stack space="s">
              <Badge
                text={specialty.source === 'sheets' ? 'Google Sheets' : 'Local fixture'}
                color={specialty.source === 'sheets' ? 'green' : 'blue'}
              />
              <Text color="secondary">
                {meta?.codes !== undefined ? `${meta.codes} codes` : 'View planning data'}
                {meta?.consolidatedArticles !== undefined
                  ? ` · ${meta.consolidatedArticles} articles`
                  : ''}
                {meta?.consolidatedSections !== undefined
                  ? ` · ${meta.consolidatedSections} sections`
                  : ''}
              </Text>
            </Stack>
          </CardBox>
        </Card>
      </NextLink>
    </div>
  );
}
