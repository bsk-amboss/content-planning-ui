'use client';

import { Button } from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StageName } from '@/lib/workflows/lib/db-writes';

const CONFIRM_MESSAGE =
  'Reset this stage? Its output and every downstream stage will be cleared for this specialty.';

export function ResetButton({
  runId,
  specialtySlug,
  stage,
}: {
  runId: string;
  specialtySlug: string;
  stage: StageName;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!window.confirm(CONFIRM_MESSAGE)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/workflows/reset-stage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, specialtySlug, stage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={onClick} disabled={submitting}>
        {submitting ? 'Resetting…' : 'Reset'}
      </Button>
      {error ? <span style={{ color: 'var(--color-red-500)' }}>{error}</span> : null}
    </>
  );
}
