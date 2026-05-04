'use client';

import {
  Button,
  Callout,
  Checkbox,
  Combobox,
  Inline,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { AmbossLibraryStats } from '@/lib/data/amboss-library';
import type { CodeCategorySummary, UnmappedCodePickerRow } from '@/lib/data/codes';
import type { ProviderId } from '@/lib/workflows/lib/llm';
import { DEFAULT_MAPPING_SYSTEM_PROMPT } from '@/lib/workflows/lib/prompts';
import { DefaultPromptModal } from './default-prompt-modal';
import { MissingKeyModal } from './missing-key-modal';
import {
  backupModelKey,
  DEFAULT_BACKUP_MODEL,
  modelKey,
  readSpec,
} from './model-selection-storage';
import { PromptSection } from './prompt-section';

// Sentinels that appear at the top of the category dropdown. We intercept
// them in onChange so they act like actions rather than real selections.
const SELECT_ALL = '__select_all__';
const CLEAR_ALL = '__clear_all__';

function fmtNum(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function fmtDate(d: Date | null): string {
  if (!d) return 'never';
  return new Date(d).toLocaleString();
}

export function StartMapCodesForm({
  specialtySlug,
  unmappedCount,
  defaultContentBase,
  libraryStats,
  categories,
  unmappedCodes,
}: {
  specialtySlug: string;
  unmappedCount: number;
  defaultContentBase: string;
  libraryStats: AmbossLibraryStats;
  categories: CodeCategorySummary[];
  unmappedCodes: UnmappedCodePickerRow[];
}) {
  const router = useRouter();
  const [contentBase, setContentBase] = useState(defaultContentBase);
  const [checkAgainstLibrary, setCheckAgainstLibrary] = useState(
    libraryStats.articles > 0,
  );
  const [instructions, setInstructions] = useState('');
  const [showDefault, setShowDefault] = useState(false);

  const allCategoryValues = useMemo(
    () => categories.map((c) => c.category),
    [categories],
  );
  // Default: all categories selected. Tracked as a string[] (the order users
  // see in the Combobox) so "all selected" and "none selected" are both
  // representable without a separate sentinel flag.
  const [selectedCats, setSelectedCats] = useState<string[]>(allCategoryValues);
  const [specificCodes, setSpecificCodes] = useState<string[]>([]);
  // Mode toggle: the user picks either a category filter OR a specific-code
  // list, never both. Default to categories when available, otherwise codes.
  const [mode, setMode] = useState<'categories' | 'codes'>(
    categories.length > 0 ? 'categories' : 'codes',
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ runId: string; token: string } | null>(null);
  const [missingKey, setMissingKey] = useState<ProviderId | null>(null);

  const librarySeeded = libraryStats.articles > 0;
  const statsLine = librarySeeded
    ? `${fmtNum(libraryStats.sections)} sections · ${fmtNum(libraryStats.articles)} articles · last synced ${fmtDate(libraryStats.lastSyncedAt)}`
    : 'No AMBOSS article library loaded yet.';

  const allSelected =
    selectedCats.length === allCategoryValues.length && allCategoryValues.length > 0;
  const selectedCategoryTotal = useMemo(() => {
    if (allSelected) return unmappedCount;
    const set = new Set(selectedCats);
    return categories
      .filter((c) => set.has(c.category))
      .reduce((sum, c) => sum + c.unmapped, 0);
  }, [allSelected, categories, selectedCats, unmappedCount]);
  const estimatedCount =
    mode === 'categories' ? selectedCategoryTotal : specificCodes.length;

  const categoryOptions = useMemo(() => {
    return [
      { value: SELECT_ALL, label: '✓  Select all categories' },
      { value: CLEAR_ALL, label: '✕  Clear all categories' },
      ...categories.map((c) => {
        const mapped = c.total - c.unmapped;
        return {
          value: c.category,
          label: `${c.category} (${mapped}/${c.total} mapped)`,
        };
      }),
    ];
  }, [categories]);

  /**
   * `<code> — <description>` options so users can search by either the code
   * ID or words in the description. `description` passed as the DS
   * `description` field too so it renders as a second line under the code.
   */
  const codeOptions = useMemo(() => {
    return unmappedCodes.map((c) => ({
      value: c.code,
      label: c.code,
      description: c.description ?? '(no description)',
    }));
  }, [unmappedCodes]);

  const onCategoryChange = (values: string[]) => {
    if (values.includes(SELECT_ALL)) {
      setSelectedCats(allCategoryValues);
      return;
    }
    if (values.includes(CLEAR_ALL)) {
      setSelectedCats([]);
      return;
    }
    setSelectedCats(values.filter((v) => v !== SELECT_ALL && v !== CLEAR_ALL));
  };

  const submitDisabled = submitting || estimatedCount === 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const primaryModel = readSpec(modelKey(specialtySlug, 'map_codes'));
    if (!primaryModel) {
      setError('Pick a primary model on the Map codes card before starting.');
      return;
    }
    const backupModel = readSpec(backupModelKey(specialtySlug)) ?? DEFAULT_BACKUP_MODEL;

    setSubmitting(true);
    try {
      // Only one of the two filters is sent per run — the mode toggle above
      // enforces an exclusive choice. For "categories": omit when the user
      // kept every category checked (equivalent to no filter).
      const categoriesPayload =
        mode === 'categories' && !allSelected && selectedCats.length > 0
          ? selectedCats
          : undefined;
      const codesPayload =
        mode === 'codes' && specificCodes.length > 0 ? specificCodes : undefined;
      const res = await fetch('/api/workflows/map-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          specialtySlug,
          contentBase: contentBase.trim() || undefined,
          additionalInstructions: instructions.trim() || undefined,
          checkAgainstLibrary,
          categories: categoriesPayload,
          codes: codesPayload,
          primaryModel,
          backupModel,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          res.status === 409 &&
          body?.code === 'MISSING_API_KEY' &&
          (body.provider === 'google' ||
            body.provider === 'anthropic' ||
            body.provider === 'openai')
        ) {
          setMissingKey(body.provider);
          return;
        }
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setSuccess({ runId: body.runId, token: body.approvalToken });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Stack space="m">
        <Text>
          Will map{' '}
          <strong>
            {fmtNum(estimatedCount)} code{estimatedCount === 1 ? '' : 's'}
          </strong>{' '}
          against the AMBOSS MCP server. Concurrency = 10. Each code tries Gemini 3 Flash
          up to 3 times, then escalates to Claude Opus 4.7 if cited article or section IDs
          still don't resolve.
        </Text>

        <Stack space="xxs">
          <Text weight="bold">AMBOSS content base</Text>
          <div style={{ width: 260 }}>
            <Select
              name="contentBase"
              value={contentBase}
              onChange={(e) => setContentBase(e.target.value)}
              options={[
                { value: 'US', label: 'US (English)' },
                { value: 'German', label: 'German (DE)' },
              ]}
            />
          </div>
          <Text color="secondary">
            The model uses this verbatim to pick the correct MCP content base.
          </Text>
        </Stack>

        <Stack space="xs">
          <SegmentedControl
            label="Mapping scope"
            isLabelHidden
            value={mode}
            onChange={(value) => setMode(value as 'categories' | 'codes')}
            options={[
              {
                name: 'mapping-scope',
                label: 'Limit to categories',
                value: 'categories',
                disabled: categories.length === 0,
              },
              {
                name: 'mapping-scope',
                label: 'Specific codes',
                value: 'codes',
                disabled: unmappedCodes.length === 0,
              },
            ]}
          />

          {mode === 'categories' ? (
            categories.length > 0 ? (
              <Combobox
                name="mappingCategories"
                label="Limit to categories"
                hint={
                  allSelected
                    ? `All ${categories.length} categories (${fmtNum(unmappedCount)} unmapped)`
                    : `${selectedCats.length} of ${categories.length} selected · ${fmtNum(selectedCategoryTotal)} unmapped codes`
                }
                multiple
                value={selectedCats}
                onChange={(values) => onCategoryChange(values as string[])}
                options={categoryOptions}
                placeholder="Select categories to map…"
                emptyStateMessage="No categories match the filter."
                maxHeight={320}
                slotProps={{
                  tag: {
                    clearButtonAriaLabel: 'Remove category',
                  },
                }}
              />
            ) : (
              <Callout
                type="info"
                text="No categories yet — extract codes first to populate the filter dropdown."
              />
            )
          ) : unmappedCodes.length > 0 ? (
            <Combobox
              name="specificCodes"
              label="Specific codes"
              hint={
                specificCodes.length === 0
                  ? `Search ${fmtNum(unmappedCodes.length)} unmapped codes by ID or description`
                  : `${specificCodes.length} code${specificCodes.length === 1 ? '' : 's'} selected`
              }
              multiple
              value={specificCodes}
              onChange={(values) => setSpecificCodes(values as string[])}
              options={codeOptions}
              placeholder="Start typing a code or description…"
              emptyStateMessage="No unmapped codes match your search."
              maxHeight={320}
              filterMethod={(option, query) => {
                if (!query) return true;
                const q = query.toLowerCase();
                const label = option.label.toLowerCase();
                const desc =
                  typeof option.description === 'string'
                    ? option.description.toLowerCase()
                    : '';
                return label.includes(q) || desc.includes(q);
              }}
              slotProps={{
                tag: {
                  clearButtonAriaLabel: 'Remove code',
                },
              }}
            />
          ) : (
            <Callout
              type="info"
              text="No unmapped codes available. Everything is already mapped."
            />
          )}
        </Stack>

        <Stack space="xxs">
          <Checkbox
            name="checkAgainstLibrary"
            label="Check mappings against article library"
            checked={checkAgainstLibrary}
            onChange={(e) => setCheckAgainstLibrary(e.target.checked)}
            disabled={!librarySeeded}
          />
          <Text color="secondary">{statsLine}</Text>
          {!librarySeeded ? (
            <Callout
              type="warning"
              text="No AMBOSS article library loaded. Run `npm run db:refresh-amboss-library -- path/to/export.json` to enable ID validation, or proceed with validation off (raw LLM output, no retry on hallucinated IDs)."
            />
          ) : !checkAgainstLibrary ? (
            <Callout
              type="info"
              text="Validation is off — each code will run one Flash attempt and accept whatever it returns, even if cited IDs aren't real."
            />
          ) : null}
        </Stack>

        <PromptSection
          title="Mapping — system prompt"
          hint="Agent prompt that drives the AMBOSS MCP analysis. Additional instructions are appended to the default."
          value={instructions}
          onChange={setInstructions}
          onViewDefault={() => setShowDefault(true)}
        />

        <Inline space="s">
          <div style={{ width: 220 }}>
            <Button type="submit" fullWidth disabled={submitDisabled}>
              {submitting ? 'Starting…' : `Start mapping (${fmtNum(estimatedCount)})`}
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
        open={showDefault}
        onClose={() => setShowDefault(false)}
        title="Mapping default system prompt"
        subHeader="Appended to any additional instructions you provide."
        text={DEFAULT_MAPPING_SYSTEM_PROMPT}
      />
      <MissingKeyModal
        open={missingKey !== null}
        provider={missingKey}
        onClose={() => setMissingKey(null)}
      />
    </form>
  );
}
