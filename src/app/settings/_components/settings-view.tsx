'use client';

import { Card, CardBox, H1, Stack, Text } from '@amboss/design-system';

export function SettingsView() {
  return (
    <Stack space="xl">
      <Stack space="s">
        <H1>Settings</H1>
        <Text color="secondary">
          Manage your provider API keys for the LLM-powered pipeline stages.
        </Text>
      </Stack>
      <Card outlined>
        <CardBox>
          <Text color="secondary">
            Coming up next: per-provider key entry for Google, Anthropic, and OpenAI, with
            a Test connection button for each.
          </Text>
        </CardBox>
      </Card>
    </Stack>
  );
}
