'use client';

import { Button, Callout, Stack } from '@amboss/design-system';

export default function PlanningError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Stack space="m">
      <Callout
        type="error"
        text={`Failed to load planning data: ${error.message}${error.digest ? ` (${error.digest})` : ''}`}
      />
      <Button onClick={reset}>Try again</Button>
    </Stack>
  );
}
