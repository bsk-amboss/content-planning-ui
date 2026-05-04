'use client';

import { Box, Card, H1, Stack, Text } from '@amboss/design-system';
import type { ReactNode } from 'react';

/**
 * Shared shell every login stage renders inside — the centred Card, the
 * H1, and the supporting copy. Keeps all four stages visually identical
 * so the only thing that varies between them is the form itself.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 480, margin: '64px auto' }}>
      <Card outlined>
        <Box space="l">
          <Stack space="l">
            <Stack space="xs">
              <H1>{title}</H1>
              <Text color="secondary">{description}</Text>
            </Stack>
            {children}
          </Stack>
        </Box>
      </Card>
    </div>
  );
}
