'use client';

import {
  Button,
  Callout,
  Card,
  CardBox,
  Inline,
  Input,
  Stack,
  Text,
} from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CodeSource } from '@/lib/workflows/lib/sources';

/**
 * Manage the set of code-source prefixes available in the start-run form's
 * Source dropdown. Seeded with `ab`, `orphanet`, `icd10` — add more as needed
 * for new content providers.
 */
export function CodeSourcesCard({ sources }: { sources: CodeSource[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const s = slug.trim().toLowerCase();
    const n = name.trim();
    if (!s) {
      setError('Slug required');
      return;
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) {
      setError('Slug must match [a-z0-9][a-z0-9_-]*');
      return;
    }
    if (!n) {
      setError('Name required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/code-sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: s, name: n }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setSlug('');
      setName('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (targetSlug: string) => {
    if (!confirm(`Delete source "${targetSlug}"?`)) return;
    const res = await fetch(`/api/code-sources/${targetSlug}`, {
      method: 'DELETE',
    });
    if (res.ok) router.refresh();
  };

  return (
    <Card title="Code sources" titleAs="h3">
      <CardBox>
        <Stack space="s">
          <Text color="secondary">
            The slug becomes the code prefix (e.g. <code>ab_&lt;specialty&gt;_0001</code>
            ). Add any source whose content you want to extract codes from.
          </Text>

          {sources.length > 0 ? (
            <Stack space="xxs">
              {sources.map((s) => (
                <Inline key={s.slug} space="s" vAlignItems="center">
                  <Text>
                    <code>{s.slug}</code>
                  </Text>
                  <Text>{s.name}</Text>
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => onDelete(s.slug)}
                  >
                    Delete
                  </Button>
                </Inline>
              ))}
            </Stack>
          ) : (
            <Text color="secondary">
              No sources yet — add one below to enable the source dropdown.
            </Text>
          )}

          <form onSubmit={onAdd}>
            <Inline space="s" vAlignItems="bottom">
              <Input
                label="Slug"
                name="new-source-slug"
                placeholder="usmle"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <Input
                label="Display name"
                name="new-source-name"
                placeholder="USMLE"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add source'}
              </Button>
            </Inline>
          </form>
          {error ? <Callout type="error" text={error} /> : null}
        </Stack>
      </CardBox>
    </Card>
  );
}
