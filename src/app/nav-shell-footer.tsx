'use client';

import { Divider, Inline, Link, Stack, Text } from '@amboss/design-system';

export function NavShellFooter({ children }: { children: React.ReactNode }) {
  return (
    <Stack space="xxl">
      {children}
      <Divider />
      <Inline space="s" alignItems="center" vAlignItems="center">
        <Text color="secondary">AMBOSS Content Planner</Text>
        <Text color="secondary">&middot;</Text>
        <Link href="https://design-system.miamed.de/" color="tertiary">
          DS Docs
        </Link>
      </Inline>
    </Stack>
  );
}
