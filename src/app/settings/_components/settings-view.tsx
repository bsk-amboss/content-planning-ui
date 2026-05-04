'use client';

import { H1, Stack, Text } from '@amboss/design-system';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { type ProviderId, ProviderKeyCard } from './provider-key-card';

const PROVIDERS: ProviderId[] = ['google', 'anthropic', 'openai'];

export function SettingsView() {
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(
    api.apiKeys.getStatusForCurrentUser,
    isAuthenticated ? {} : 'skip',
  );

  return (
    <Stack space="xl">
      <Stack space="s">
        <H1>Settings</H1>
        <Text color="secondary">
          Provider keys are stored per user. Each pipeline stage card lets you pick which
          provider+model to use; the corresponding key here is what powers the run.
        </Text>
      </Stack>
      <Stack space="m">
        {PROVIDERS.map((p) => (
          <ProviderKeyCard
            key={p}
            provider={p}
            configured={status?.[p].configured ?? false}
            testedAt={status?.[p].testedAt ?? null}
            status={status?.[p].status ?? null}
          />
        ))}
      </Stack>
    </Stack>
  );
}
