'use client';

import { Button } from '@amboss/design-system';
import { useTransition } from 'react';
import { refreshSpecialty } from '../[specialty]/actions';

export function RefreshButton({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="tertiary"
      onClick={() => start(() => refreshSpecialty(slug))}
      disabled={pending}
    >
      {pending ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
}
