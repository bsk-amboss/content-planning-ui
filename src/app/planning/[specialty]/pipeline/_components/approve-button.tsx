'use client';

import { Button, Inline } from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ApproveButton({
  runId,
  specialtySlug,
  stage,
}: {
  runId: string;
  specialtySlug: string;
  stage: 'extract_codes' | 'extract_milestones' | 'map_codes';
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (approved: boolean) => {
    setSubmitting(approved ? 'approve' : 'reject');
    setError(null);
    try {
      const res = await fetch('/api/workflows/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, specialtySlug, stage, approved }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Inline space="s">
      <Button onClick={() => send(true)} disabled={submitting !== null}>
        {submitting === 'approve' ? 'Approving…' : 'Approve'}
      </Button>
      <Button
        variant="secondary"
        onClick={() => send(false)}
        disabled={submitting !== null}
      >
        {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
      </Button>
      {error ? <span style={{ color: 'var(--color-red-500)' }}>{error}</span> : null}
    </Inline>
  );
}
