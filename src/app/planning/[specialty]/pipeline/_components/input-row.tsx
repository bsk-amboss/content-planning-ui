'use client';

import { Button, Callout, H6, Input, Select, Stack } from '@amboss/design-system';
import { upload } from '@vercel/blob/client';
import { useRef } from 'react';
import type { CodeSource } from '@/lib/workflows/lib/sources';

const ADD_SOURCE_SENTINEL = '__add_new_source__';

export type UploadedFile = { name: string; url: string };

export type InputRowState = {
  id: string;
  source: string;
  kind: 'url' | 'file';
  url: string;
  upload: UploadedFile | null;
  uploading: boolean;
  uploadError: string | null;
};

export function newInputRow(defaultSource: string): InputRowState {
  return {
    id: crypto.randomUUID(),
    source: defaultSource,
    kind: 'url',
    url: '',
    upload: null,
    uploading: false,
    uploadError: null,
  };
}

/**
 * Client uploads go through `@vercel/blob/client#upload`, which requires a
 * short-lived token from `/api/blob/upload-token`. When `BLOB_READ_WRITE_TOKEN`
 * isn't provisioned, the client's own error is the unhelpful "Failed to
 * retrieve the client token" — it doesn't surface the server's 501 body. Do a
 * quick preflight so the user sees the real reason (and a fix path).
 */
export async function explainUploadFailure(fallback: string): Promise<string> {
  try {
    const res = await fetch('/api/blob/upload-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.status === 501) {
      const body = await res.json().catch(() => ({}));
      return typeof body?.error === 'string' ? body.error : fallback;
    }
  } catch {
    // fall through
  }
  return fallback;
}

export function InputRow({
  row,
  index,
  canRemove,
  sources,
  onChange,
  onRemove,
  onRequestAddSource,
}: {
  row: InputRowState;
  index: number;
  canRemove: boolean;
  sources: CodeSource[];
  onChange: (patch: Partial<InputRowState>) => void;
  onRemove: () => void;
  onRequestAddSource: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ uploading: true, uploadError: null });
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload-token',
        contentType: 'application/pdf',
      });
      onChange({
        upload: { name: file.name, url: blob.url },
        uploading: false,
      });
    } catch (err) {
      const generic = err instanceof Error ? err.message : String(err);
      const message = await explainUploadFailure(generic);
      onChange({ uploading: false, uploadError: message });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  // Two-row grid per input row: first row holds labels (header row only),
  // second row holds the form controls. Decoupling labels from the controls
  // keeps them pixel-aligned regardless of control-height differences
  // (Button ≠ Input ≠ Select). Non-header rows skip the label row entirely.
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '180px 140px minmax(0, 1fr) auto',
    columnGap: 12,
    rowGap: 4,
    alignItems: 'end',
  };
  const isHeaderRow = index === 0;
  const urlLabel = row.kind === 'url' ? 'Content outline URL' : 'Content outline PDF';

  return (
    <Stack space="xxs">
      <div style={gridStyle}>
        {isHeaderRow ? (
          <>
            <H6 as="div">Source</H6>
            <H6 as="div">Type</H6>
            <H6 as="div">{urlLabel}</H6>
            <span aria-hidden />
          </>
        ) : null}
        <Select
          name={`source-${row.id}`}
          value={row.source}
          onChange={(e) => {
            if (e.target.value === ADD_SOURCE_SENTINEL) {
              // Keep row.source unchanged; the Select briefly re-renders with
              // the old value while the modal opens.
              onRequestAddSource();
              return;
            }
            onChange({ source: e.target.value });
          }}
          options={[
            ...sources.map((s) => ({ value: s.slug, label: s.name })),
            { value: ADD_SOURCE_SENTINEL, label: '+ Add new source…' },
          ]}
        />
        <Select
          name={`kind-${row.id}`}
          value={row.kind}
          onChange={(e) =>
            onChange({ kind: e.target.value as 'url' | 'file', upload: null, url: '' })
          }
          options={[
            { value: 'url', label: 'URL' },
            { value: 'file', label: 'PDF upload' },
          ]}
        />
        {row.kind === 'url' ? (
          <Input
            name={`url-${row.id}`}
            placeholder="https://example.com/outline.pdf"
            value={row.url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        ) : (
          <div>
            <Button
              type="button"
              variant="secondary"
              disabled={row.uploading}
              onClick={() => fileInput.current?.click()}
            >
              {row.uploading
                ? 'Uploading…'
                : row.upload
                  ? row.upload.name
                  : 'Choose file'}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              onChange={onFilePick}
              disabled={row.uploading}
              style={{ display: 'none' }}
            />
          </div>
        )}
        <Button type="button" variant="tertiary" disabled={!canRemove} onClick={onRemove}>
          Remove
        </Button>
      </div>
      {row.uploadError ? (
        <Callout type="error" text={`Upload failed: ${row.uploadError}`} />
      ) : null}
    </Stack>
  );
}
