'use client';

import { Badge, Card, CardBox, Inline, Stack, Text } from '@amboss/design-system';
import NextLink from 'next/link';
import { PHASE_COLOR, PHASE_LABEL, type Phase } from '@/lib/phase';
import type { Specialty } from '@/lib/repositories/types';

export function SpecialtyCard({
  specialty,
  phase,
  meta,
}: {
  specialty: Specialty;
  phase?: Phase;
  meta?: { codes?: number; consolidatedArticles?: number; consolidatedSections?: number };
}) {
  const href = `/planning/${specialty.slug}`;
  const resolvedPhase: Phase = phase ?? 'not_started';
  return (
    <div className="card-fill">
      <NextLink href={href} style={{ textDecoration: 'none' }}>
        <Card title={specialty.name} titleAs="h3" outlined>
          <CardBox>
            <Stack space="s">
              <Inline space="xs">
                <Badge
                  text={specialty.source === 'sheets' ? 'Google Sheets' : 'Local fixture'}
                  color={specialty.source === 'sheets' ? 'green' : 'blue'}
                />
                <Badge
                  text={PHASE_LABEL[resolvedPhase]}
                  color={PHASE_COLOR[resolvedPhase]}
                />
              </Inline>
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
