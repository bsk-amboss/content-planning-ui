'use client';

import {
  Button,
  Callout,
  H6,
  Inline,
  Input,
  Select,
  Stack,
  Text,
  Textarea,
} from '@amboss/design-system';
import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  DEFAULT_EXTRACT_SYSTEM_PROMPT,
  DEFAULT_IDENTIFY_SYSTEM_PROMPT,
} from '@/lib/workflows/lib/prompts';
import type { CodeSource } from '@/lib/workflows/lib/sources';
import { AddSourceModal } from './add-source-modal';
import { DefaultPromptModal } from './default-prompt-modal';

const ADD_SOURCE_SENTINEL = '__add_new_source__';

type UploadedFile = { name: string; url: string };

type Row = {
  id: string;
  source: string;
  kind: 'url' | 'file';
  url: string;
  upload: UploadedFile | null;
  uploading: boolean;
  uploadError: string | null;
};

function newRow(defaultSource: string): Row {
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
async function explainUploadFailure(fallback: string): Promise<string> {
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

export function StartRunForm({
  specialtySlug,
  sources,
}: {
  specialtySlug: string;
  sources: CodeSource[];
}) {
  const router = useRouter();
  const defaultSource = sources[0]?.slug ?? 'ab';
  const [rows, setRows] = useState<Row[]>([newRow(defaultSource)]);
  const [identifyInstructions, setIdentifyInstructions] = useState('');
  const [extractInstructions, setExtractInstructions] = useState('');
  const [showIdentifyDefault, setShowIdentifyDefault] = useState(false);
  const [showExtractDefault, setShowExtractDefault] = useState(false);
  const [addSourceForRowId, setAddSourceForRowId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ runId: string; token: string } | null>(null);

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow(defaultSource)]);

  const anyUploading = rows.some((r) => r.uploading);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (sources.length === 0) {
      setError('Add at least one code source before starting a run.');
      return;
    }

    const inputs: Array<{ source: string; url: string }> = [];
    for (const [i, row] of rows.entries()) {
      if (row.kind === 'url') {
        const u = row.url.trim();
        if (!u.startsWith('http')) {
          setError(`Row ${i + 1}: enter a valid http(s) URL`);
          return;
        }
        inputs.push({ source: row.source, url: u });
      } else {
        if (!row.upload) {
          setError(`Row ${i + 1}: upload a PDF first`);
          return;
        }
        inputs.push({ source: row.source, url: row.upload.url });
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/workflows/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          specialtySlug,
          inputs,
          identifyModulesInstructions: identifyInstructions.trim() || undefined,
          extractCodesInstructions: extractInstructions.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setSuccess({ runId: body.runId, token: body.approvalToken });
      setRows([newRow(defaultSource)]);
      setIdentifyInstructions('');
      setExtractInstructions('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Stack space="m">
        <Stack space="xs">
          <Text weight="bold">Inputs</Text>
          <Text color="secondary">
            Each row is a content outline to extract codes from. The source slug becomes
            the code prefix (e.g.{' '}
            <code>
              {defaultSource}_{specialtySlug}_0001
            </code>
            ).
          </Text>
          {rows.map((row, idx) => (
            <InputRow
              key={row.id}
              row={row}
              index={idx}
              canRemove={rows.length > 1}
              sources={sources}
              onChange={(patch) => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
              onRequestAddSource={() => setAddSourceForRowId(row.id)}
            />
          ))}
          <Inline space="s">
            <div style={{ width: 180 }}>
              <Button type="button" variant="secondary" fullWidth onClick={addRow}>
                + Add another input
              </Button>
            </div>
          </Inline>
        </Stack>

        <PromptSection
          title="Phase 1 — Identify modules"
          hint="Runs once per input. Splits the PDF/URL into chapters."
          value={identifyInstructions}
          onChange={setIdentifyInstructions}
          onViewDefault={() => setShowIdentifyDefault(true)}
        />
        <PromptSection
          title="Phase 2 — Extract codes"
          hint="Runs once per (input, module). Pulls discrete medical items."
          value={extractInstructions}
          onChange={setExtractInstructions}
          onViewDefault={() => setShowExtractDefault(true)}
        />

        <Inline space="s">
          <div style={{ width: 180 }}>
            <Button type="submit" fullWidth disabled={submitting || anyUploading}>
              {submitting ? 'Starting…' : 'Start extraction'}
            </Button>
          </div>
        </Inline>
        {error ? <Callout type="error" text={error} /> : null}
        {success ? (
          <Callout
            type="success"
            text={`Run started: ${success.runId} — approval token: ${success.token}`}
          />
        ) : null}
      </Stack>

      <DefaultPromptModal
        open={showIdentifyDefault}
        onClose={() => setShowIdentifyDefault(false)}
        title="Phase 1 default prompt — Identify modules"
        subHeader="Appended to any additional instructions you provide."
        text={DEFAULT_IDENTIFY_SYSTEM_PROMPT}
      />
      <DefaultPromptModal
        open={showExtractDefault}
        onClose={() => setShowExtractDefault(false)}
        title="Phase 2 default prompt — Extract codes"
        subHeader="Appended to any additional instructions you provide."
        text={DEFAULT_EXTRACT_SYSTEM_PROMPT}
      />
      <AddSourceModal
        open={addSourceForRowId !== null}
        onClose={() => setAddSourceForRowId(null)}
        onCreated={(source) => {
          if (addSourceForRowId) {
            updateRow(addSourceForRowId, { source: source.slug });
          }
          setAddSourceForRowId(null);
          // Refresh so the new source shows up in every row's dropdown (and
          // in the Code sources card below the dashboard).
          router.refresh();
        }}
      />
    </form>
  );
}

function InputRow({
  row,
  index,
  canRemove,
  sources,
  onChange,
  onRemove,
  onRequestAddSource,
}: {
  row: Row;
  index: number;
  canRemove: boolean;
  sources: CodeSource[];
  onChange: (patch: Partial<Row>) => void;
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

// Shared grid template for the Phase 1 / Phase 2 header rows so both sections'
// title + default-prompt button + add/remove button line up across sections.
const PROMPT_HEADER_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '260px 180px 180px',
  columnGap: 12,
  alignItems: 'center',
};

function PromptSection({
  title,
  hint,
  value,
  onChange,
  onViewDefault,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  onViewDefault: () => void;
}) {
  // Keep the textarea open if the caller already has instructions (e.g. after
  // a router.refresh() rehydrates state); otherwise start collapsed so the
  // form stays compact and users opt in only when they need to tweak prompts.
  const [expanded, setExpanded] = useState(value.length > 0);

  return (
    <Stack space="xxs">
      <div style={PROMPT_HEADER_GRID}>
        <Text weight="bold">{title}</Text>
        <Button type="button" variant="tertiary" onClick={onViewDefault}>
          View default prompt
        </Button>
        {expanded ? (
          <Button
            type="button"
            variant="tertiary"
            onClick={() => {
              setExpanded(false);
              onChange('');
            }}
          >
            Remove instructions
          </Button>
        ) : (
          <Button type="button" variant="tertiary" onClick={() => setExpanded(true)}>
            + Add instructions
          </Button>
        )}
      </div>
      <Text color="secondary">{hint}</Text>
      {expanded ? (
        <Textarea
          name={title}
          label="Additional instructions (appended to default)"
          placeholder="Leave empty to use the default as-is."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      ) : null}
    </Stack>
  );
}
