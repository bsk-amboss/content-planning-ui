'use client';

import { Divider, Inline, Link, Stack, Text } from '@amboss/design-system';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import { useRouter } from 'next/navigation';

export function NavShellFooter({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

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
        {isAuthenticated && (
          <>
            <Text color="secondary">&middot;</Text>
            <Link
              as="button"
              color="tertiary"
              onClick={async () => {
                await signOut();
                router.replace('/login');
              }}
            >
              Sign out
            </Link>
          </>
        )}
      </Inline>
    </Stack>
  );
}
