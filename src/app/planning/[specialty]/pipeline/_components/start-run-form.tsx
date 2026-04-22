'use client';

import { Button, Callout, Stack, Text, Textarea } from '@amboss/design-system';
import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type UploadedFile = {
  name: string;
  url: string;
};

export function StartRunForm({ specialtySlug }: { specialtySlug: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [urlsRaw, setUrlsRaw] = useState('');
  const [promptOverride, setPromptOverride] = useState('');
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ runId: string; token: string } | null>(null);

  const parseUrls = (raw: string): string[] =>
    raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http'));

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/blob/upload-token',
          contentType: 'application/pdf',
        });
        setUploaded((prev) => [...prev, { name: file.name, url: blob.url }]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeUploaded = (url: string) => {
    setUploaded((prev) => prev.filter((u) => u.url !== url));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = [...parseUrls(urlsRaw), ...uploaded.map((u) => u.url)];
    if (urls.length === 0) {
      setError('Provide at least one URL or upload a PDF');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/workflows/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          specialtySlug,
          contentOutlineUrls: urls,
          extractionSystemPrompt: promptOverride || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setSuccess({ runId: body.runId, token: body.approvalToken });
      setUrlsRaw('');
      setPromptOverride('');
      setUploaded([]);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Stack space="s">
        <Textarea
          name="urls"
          label="Content outline URLs"
          placeholder="https://example.com/outline.pdf (one per line)"
          value={urlsRaw}
          onChange={(e) => setUrlsRaw(e.target.value)}
          rows={4}
        />
        <Stack space="xxs">
          <label htmlFor="pdf-upload">
            <Text>Or upload PDF files</Text>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="pdf-upload"
              ref={fileInput}
              type="file"
              accept="application/pdf"
              multiple
              onChange={onFilePick}
              disabled={uploading}
            />
            {uploading ? <Text color="secondary">Uploading…</Text> : null}
          </div>
        </Stack>
        {uploaded.length > 0 ? (
          <Stack space="xs">
            {uploaded.map((u) => (
              <div key={u.url} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text>{u.name}</Text>
                <button
                  type="button"
                  onClick={() => removeUploaded(u.url)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-red-500)',
                    padding: 0,
                  }}
                >
                  remove
                </button>
              </div>
            ))}
          </Stack>
        ) : null}
        {uploadError ? (
          <Callout type="error" text={`Upload failed: ${uploadError}`} />
        ) : null}
        <Textarea
          name="prompt"
          label="System prompt override (optional)"
          placeholder="Leave empty to use the region default."
          value={promptOverride}
          onChange={(e) => setPromptOverride(e.target.value)}
          rows={3}
        />
        <Button type="submit" disabled={submitting || uploading}>
          {submitting ? 'Starting…' : 'Start extraction'}
        </Button>
        {error ? <Callout type="error" text={error} /> : null}
        {success ? (
          <Callout
            type="success"
            text={`Run started: ${success.runId} — approval token: ${success.token}`}
          />
        ) : null}
      </Stack>
    </form>
  );
}
