'use client';

import { H1, Stack, Text } from '@amboss/design-system';

export default function Home() {
  return (
    <Stack space="m" alignItems="center">
      <H1 align="center">amboss-content-planner-ui</H1>
      <Text color="secondary" align="center">
        A Next.js app powered by the AMBOSS Design System. Built with{' '}
        <code>create-amboss-app</code>.
      </Text>
    </Stack>
  );
}
