'use client';

import { Button } from '@amboss/design-system';
import { useRouter } from 'next/navigation';

export function ChangeSpecialtyButton() {
  const router = useRouter();
  return (
    <Button
      variant="tertiary"
      size="s"
      onClick={() => {
        window.localStorage.removeItem('lastSpecialty');
        router.push('/planning');
      }}
    >
      Change specialty
    </Button>
  );
}
