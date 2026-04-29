# Phase 2b: Port n8n Pipeline to Vercel Workflow DevKit

## Context

Phase 1 (read-only dashboard over xlsx/sheets) and Phase 2a (Neon Postgres swap) are shipped and committed. Today the n8n pipeline is still the writer: it extracts codes + milestones from PDFs, maps each code via Gemini + the AMBOSS MCP server, and consolidates suggestions into articles/sections. The Postgres tables are *seeded* from xlsx snapshots of n8n's Google Sheets.

**Goal**: replace n8n with a durable, observable pipeline running on Vercel Workflow DevKit, writing directly to Postgres. Crashes mid-run resume cleanly (durable checkpoints). Users approve intermediate artifacts before the next stage kicks off. Per-code LLM calls in the mapping stage parallelize instead of running 1-by-1.

**Scope of this plan**: lay down the **overall structure** (stages, approval gates, schema, UI dashboard) plus **detailed preprocessing** (code extraction + milestone extraction). Mapping and consolidation get scaffolded but their internals are filled in as the user hands over n8n workflow JSON piece by piece.

---

## Pipeline shape

```
┌──────────────────── Preprocessing ────────────────────┐
│  extract-codes        extract-milestones              │  (parallel, independent)
│         ↓                    ↓                        │
│  writes extracted_codes   writes draft milestones     │
│         ↓                    ↓                        │
│    AWAITS APPROVAL ← both required → AWAITS APPROVAL  │  (human-in-the-loop)
└────────────────────────┬──────────────────────────────┘
                         ↓
┌────────────────────── Mapping ────────────────────────┐
│  map-codes  (per-code LLM + AMBOSS MCP, parallel pool)│
│         ↓                                             │
│  writes codes.* mapping fields                        │
└────────────────────────┬──────────────────────────────┘
                         ↓
┌──────────── Suggestion Consolidation ─────────────────┐
│  consolidate-primary   (per consolidationCategory:    │
│    combine all code mappings → two buckets:           │
│      1. new-article candidates                        │
│      2. article-update candidates — new sections +    │
│         section updates)                              │
│         ↓                                             │
│  consolidate-articles-secondary                       │
│    (across all new articles — dedupe, title merge)    │
│         ↓                                             │
│  consolidate-sections-secondary                       │
│    (within each article — dedupe sections/updates)    │
└───────────────────────────────────────────────────────┘
```

**Rules**:
- Preprocessing runs the two extract stages **in parallel** (no order dependency). Both must reach the approved state before mapping can start.
- Mapping is sequential **as a stage**, but inside it fans out per-code LLM work with a concurrency cap (initial: 10).
- Consolidation is three sequential sub-stages. Primary per-category can parallelize across categories; secondary consolidations are serial (they synthesize across the whole set).

---

## Data model additions

`src/lib/db/schema.ts` — add four things:

1. **`specialties.milestones: jsonb`** — once approved, the final milestone set lives here. Draft sits in the pipeline run record.
2. **`pipeline_runs`** — one row per "start the whole pipeline" invocation:
   ```
   id (uuid, pk)
   specialtySlug (fk → specialties.slug, cascade)
   status: 'running' | 'awaiting_preprocessing_approval' | 'mapping' | 'consolidating' | 'completed' | 'failed' | 'cancelled'
   workflowRunId (text)              -- Vercel Workflow run id
   startedAt, updatedAt, finishedAt
   error text
   ```
3. **`pipeline_stages`** — one row per stage per run:
   ```
   id (uuid, pk)
   runId (fk → pipeline_runs.id, cascade)
   stage: 'extract_codes' | 'extract_milestones' | 'map_codes' | 'consolidate_primary' | 'consolidate_articles' | 'consolidate_sections'
   status: 'pending' | 'running' | 'awaiting_approval' | 'approved' | 'completed' | 'failed' | 'skipped'
   workflowRunId text                 -- child workflow if stage has its own
   startedAt, finishedAt, approvedAt, approvedBy
   outputSummary jsonb                -- { extracted: 2577, categories: 50, ... }
   draftPayload jsonb                 -- e.g. draft milestones before approval; big extraction outputs go in staging tables instead
   errorMessage text
   ```
4. **`extracted_codes`** — staging table for pre-approval code extraction output (keeps fresh runs separate from n8n-seeded `codes`):
   ```
   id (uuid, pk)
   runId (fk → pipeline_runs.id, cascade)
   specialtySlug (fk → specialties.slug, cascade)
   code text, category text, description text, source text
   metadata jsonb           -- anything from extraction that's not yet normalized
   createdAt
   index on (runId, specialtySlug)
   ```
   On approval, rows flow into `codes` (bare mapping fields left null). Mapping stage populates them.

---

## File layout

```
src/lib/workflows/
  preprocessing/
    extract-codes.ts         # "use workflow" — calls gemini extraction step, writes staging rows
    extract-milestones.ts    # "use workflow" — calls gemini milestones step, writes draft to pipeline_stages.draftPayload
    index.ts                 # runPreprocessing(specialtySlug): parallel fan-out of the two, awaits both hooks
  mapping/
    map-codes.ts             # "use workflow" — reads approved extracted_codes, fans out per-code agent calls
    index.ts
  consolidation/
    primary.ts               # per consolidationCategory
    articles-secondary.ts
    sections-secondary.ts
    index.ts
  run-pipeline.ts            # "use workflow" — top-level orchestrator wiring the three stages + approvals
  lib/
    gemini.ts                # wraps AI SDK v6 + @ai-sdk/google (Gemini) — all "use step"
    amboss-mcp.ts            # wraps @ai-sdk/react MCP client via experimental_createMCPClient — all "use step"
    db-writes.ts             # pipeline_runs / pipeline_stages / extracted_codes / codes writes — all "use step"
    approval.ts              # createHook helpers for stage-approval tokens (deterministic: `approve:<runId>:<stage>`)

src/app/api/workflows/
  run/route.ts               # POST — starts run-pipeline for a specialty
  approve/route.ts           # POST — resumes the approval hook for a given run + stage
  status/route.ts            # GET  — current pipeline state for a specialty

src/app/planning/[specialty]/pipeline/
  page.tsx                   # Pipeline dashboard — stage list grouped by category
  _components/
    stage-card.tsx           # stage name, status badge, run/approve buttons, summary counts
    category-group.tsx       # "Preprocessing" | "Mapping" | "Consolidation" group wrapper
    approve-button.tsx       # 'use client' — posts to /api/workflows/approve with hook token
```

---

## Specialty registry (region model, new)

The n8n pipeline keeps its master config in `board_specialty_mapping_competencies.xlsx` at the repo root:

- Tab `master` (1 row per region): `region | language | regionSpecialtyWorksheetUrl | systemPrompt`
  - `us | english`, `de | german` today; `systemPrompt` differs per region (the description row holds the milestones prompt — two system prompts total per region).
- Tab `us` / `de` (1 row per specialty): `specialty | content_outline_links | are_codes_extracted | mapping_sheet | mapping_complete | milestones_url | milestones | ...` plus per-entity worksheet URLs we're retiring.

We mirror the parts that matter for extraction onto the `specialties` row (column additions below). Per-entity worksheet URLs stay out — those pointed at Sheets-world tables that now live in Postgres.

### Schema migration `0002_specialty_region`

Add to `specialties`:

```
region                  text           -- 'us' | 'de' | ...
language                text           -- 'en' | 'de' | ...
contentOutlineUrls      jsonb          -- string[] of PDF URLs (from content_outline_links)
extractionSystemPrompt  text           -- region-derived at import time; editable per specialty
milestonesSystemPrompt  text           -- region-derived at import time; editable per specialty
```

All nullable; existing `anesthesiology` row survives with nulls until backfilled.

### `scripts/import-board-mapping.ts` (new, prerequisite for smoke)

Reads `board_specialty_mapping_competencies.xlsx`:

1. Parse `master` tab → `{ region → { language, systemPrompt (codes), milestonesPrompt (descriptions row) } }`.
2. For each region, parse the matching tab (`us`, `de`, ...) → row per specialty.
3. Upsert into `specialties` with `region`, `language`, `contentOutlineUrls` (parsed from comma-split `content_outline_links`), `extractionSystemPrompt`, `milestonesSystemPrompt`. `name` defaults to title-case slug; `slug` = `specialty` column lowercased + snake-cased.

Idempotent — re-runnable. Skips empty rows.

---

## Preprocessing — detailed

### Two-phase code extraction (matches n8n pipeline)

n8n's code-extraction workflows (`code_extractor_orchestrator.json`, `specialty_code_extraction_subworkflow.json`, `content_outline_extractor_subworkflow.json`, `content_outline_category_extractor_subworkflow.json`) run in two Gemini phases per PDF:

1. **Identify modules** — one Gemini call per PDF URL returns `[{ category: "<base category name>" }]` (document chunks / chapters).
2. **Extract codes per category** — one Gemini call per `(url, category)` returns `[{ category: "Hierarchical | Path | With | Ancestors", description: "<discrete medical term>" }]`.
3. Final rows get `code = "ab_<slug>_<index>"`, `source = "ab"`, `category` = the hierarchical path from phase 2.

Gemini config (lifted from n8n): model `gemini-3-pro-preview`, `temperature=1`, `topP=0.95`, `topK=64`, `thinking_level=HIGH`, `url_context` tool enabled. If `gemini-3-pro-preview` isn't exposed via `@ai-sdk/google` yet, fall back to `gemini-2.5-pro` and note the divergence — swap back when available.

### `src/lib/workflows/lib/gemini.ts` — add two steps (keep existing stubs)

```ts
// Phase 1
export async function identifyModulesForUrl(input: {
  url: string;
  systemPrompt: string;
  specialtySlug: string;
}): Promise<{ category: string }[]> {
  "use step";
  if (!hasGeminiCreds()) {
    return [{ category: 'Stubbed Module A' }, { category: 'Stubbed Module B' }];
  }
  // AI SDK v6 generateObject w/ Zod schema + url_context tool
  throw new Error('Real identifyModules not yet wired');
}

// Phase 2
export async function extractCodesForCategory(input: {
  url: string;
  category: string;
  specialtySlug: string;
  systemPrompt: string;
}): Promise<{ category: string; description: string }[]> {
  "use step";
  if (!hasGeminiCreds()) {
    return [
      { category: `${input.category} | Sub A`, description: 'Stubbed item 1' },
      { category: `${input.category} | Sub B`, description: 'Stubbed item 2' },
    ];
  }
  throw new Error('Real extractCodes not yet wired');
}
```

Retire the generic `extractCodesFromPdfs` stub added in Step 3 — superseded by these two (keep it only if we still want it as an integration-test hook).

### `src/lib/workflows/lib/util.ts` — new helper

```ts
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
```

### `src/lib/workflows/preprocessing/extract-codes.ts` (revised)

```ts
"use workflow";
import { FatalError, createHook } from 'workflow';
import {
  identifyModulesForUrl,
  extractCodesForCategory,
} from '../lib/gemini';
import {
  markStageRunning,
  markStageAwaitingApproval,
  markStageCompleted,
  markStageFailed,
  writeExtractedCodes,
  promoteExtractedCodesToCodes,
} from '../lib/db-writes';
import { approvalToken, type ApprovalPayload } from '../lib/approval';
import { chunk } from '../lib/util';

const URL_CONCURRENCY = 10;
const CATEGORY_CONCURRENCY = 10;

export async function extractCodesWorkflow(input: {
  runId: string;
  specialtySlug: string;
  contentOutlineUrls: string[];
  systemPrompt: string;
}) {
  "use workflow";
  try {
    await markStageRunning(input.runId, 'extract_codes');

    // Phase 1: identify modules per URL, in batches of 10
    const perUrlCategories: { url: string; category: string }[] = [];
    for (const batch of chunk(input.contentOutlineUrls, URL_CONCURRENCY)) {
      const results = await Promise.all(
        batch.map((url) =>
          identifyModulesForUrl({
            url,
            systemPrompt: input.systemPrompt,
            specialtySlug: input.specialtySlug,
          }),
        ),
      );
      results.forEach((mods, i) => {
        for (const m of mods) perUrlCategories.push({ url: batch[i], category: m.category });
      });
    }

    // Phase 2: extract codes per (url, category), in batches of 10
    const extracted: { category: string; description: string }[] = [];
    for (const batch of chunk(perUrlCategories, CATEGORY_CONCURRENCY)) {
      const results = await Promise.all(
        batch.map((p) =>
          extractCodesForCategory({
            url: p.url,
            category: p.category,
            specialtySlug: input.specialtySlug,
            systemPrompt: input.systemPrompt,
          }),
        ),
      );
      for (const items of results) extracted.push(...items);
    }

    // Assign ab_<slug>_<index> IDs, tag source='ab'
    const rawCodes = extracted.map((c, i) => ({
      code: `ab_${input.specialtySlug}_${String(i + 1).padStart(4, '0')}`,
      category: c.category,
      description: c.description,
      source: 'ab' as const,
    }));

    const { inserted } = await writeExtractedCodes(
      input.runId,
      input.specialtySlug,
      rawCodes,
    );
    await markStageAwaitingApproval(input.runId, 'extract_codes', {
      extracted: inserted,
      pdfs: input.contentOutlineUrls.length,
      modules: perUrlCategories.length,
    });

    using hook = createHook<ApprovalPayload>({
      token: approvalToken(input.runId, 'extract_codes'),
    });
    const approval = await hook;

    if (!approval.approved) {
      await markStageFailed(
        input.runId,
        'extract_codes',
        `Rejected${approval.note ? `: ${approval.note}` : ''}`,
      );
      throw new FatalError('Code extraction rejected');
    }

    await promoteExtractedCodesToCodes(input.runId, input.specialtySlug);
    await markStageCompleted(input.runId, 'extract_codes', approval.approvedBy);
  } catch (e) {
    if (e instanceof FatalError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    await markStageFailed(input.runId, 'extract_codes', msg);
    throw e;
  }
}
```

Each Gemini call is a `"use step"`, so a crash mid-fan-out resumes on retry: completed (url, category) pairs replay as cache hits from the event log.

### `extract-milestones.ts`

Same shape (single-phase for now — user hasn't shared the n8n milestones workflow yet). Input adds `systemPrompt` from `specialties.milestonesSystemPrompt`. Writes draft milestones to `pipeline_stages.draftPayload`. On approval → `writeApprovedMilestones(slug, draftPayload.milestones)` + `markStageCompleted`. Flesh out when the n8n workflow lands.

### `preprocessing/index.ts` — orchestrates both in parallel

```ts
"use workflow";
export async function runPreprocessing(input: {
  runId: string;
  specialtySlug: string;
  contentOutlineUrls: string[];
  extractionSystemPrompt: string;
  milestonesSystemPrompt: string;
}) {
  "use workflow";
  await Promise.all([
    extractCodesWorkflow({
      runId: input.runId,
      specialtySlug: input.specialtySlug,
      contentOutlineUrls: input.contentOutlineUrls,
      systemPrompt: input.extractionSystemPrompt,
    }),
    extractMilestonesWorkflow({
      runId: input.runId,
      specialtySlug: input.specialtySlug,
      contentOutlineUrls: input.contentOutlineUrls,
      systemPrompt: input.milestonesSystemPrompt,
    }),
  ]);
  await updatePipelineRunStatus(input.runId, 'mapping');
}
```

### Approval flow (UI → API → hook)

1. UI's "Approve" button POSTs `{ runId, stage, approvedBy? }` to `/api/workflows/approve`.
2. Route calls `resumeHook(approvalToken(runId, stage), { approved: true, approvedBy })`.
3. The paused workflow resumes, runs promotion steps, marks stage completed, and (for preprocessing/index.ts) the outer `Promise.all` resolves → pipeline status → `'mapping'`.

### Deferred decisions for preprocessing

- **PDF source**: PDFs are **already URLs** in the board xlsx (`content_outline_links`, comma-separated). No Vercel Blob needed for Step 4 — just pass the URLs straight to `url_context`. Blob becomes relevant later for user-uploaded PDFs.
- **Gemini model**: `gemini-3-pro-preview` from n8n. Use if `@ai-sdk/google` exposes it; else `gemini-2.5-pro` + note divergence.
- **System prompt storage**: per-specialty column (copied from region at import time). Lets each specialty diverge later without re-architecting.
- **`are_codes_extracted` boolean on region sheet**: we don't need it — `pipeline_stages.status` covers this richer and per-run.

---

## Mapping — sketched (details when user shares n8n mapping workflow)

- `map-codes.ts` reads approved `codes` rows (those with null mapping fields) for the specialty.
- For each code, a `"use step"` function runs a `DurableAgent` that:
  - Takes the code + description + category as input.
  - Uses an MCP client against `https://content-mcp.de.production.amboss.com/mcp` with `AMBOSS_MCP_TOKEN`.
  - Calls tools exposed by that MCP server to look up AMBOSS articles.
  - Returns the mapping verdict (`isInAMBOSS`, `coverageLevel`, `newArticlesNeeded[]`, `existingArticleUpdates[]`, etc.).
- Fan-out with a concurrency cap — inside the workflow function, batch N codes at a time:
  ```ts
  for (const batch of chunk(codes, 10)) {
    await Promise.all(batch.map(c => mapOneCode(input.runId, c)));
  }
  ```
  Each `mapOneCode` is `"use step"`, so it's durable + retried on failure. A crash at code 150/2577 resumes at 151 — the step cache handles completed ones.
- Writes update existing `codes` rows in place (`db.update(codes).where(eq(codes.id, ...)).set(mappingFields)`).

**Open**: exact tool schema + system prompt for the mapping agent comes from the user's n8n agent node config.

---

## Consolidation — sketched

- **Primary** (`consolidation/primary.ts`): for each distinct `consolidationCategory` in `codes`, fan out one step that reads all mappings in that category and produces:
  - New-article candidates → initial rows in `new_article_suggestions` (or a staging variant if we want approval per category; TBD based on n8n output).
  - Article-update candidates → initial rows split into `consolidated_sections` (new sections + section updates bundle).
- **Articles-secondary**: one LLM pass across all new-article candidates for the specialty → dedupe, merge titles → writes `consolidated_articles`.
- **Sections-secondary**: within each article's sections, dedupe/merge → finalizes `consolidated_sections`.

These are the most LLM-prompt-heavy stages, so exact prompts / output schemas wait for the user's n8n workflow JSON.

---

## UI — Pipeline dashboard (Step 8)

### Phase model

Every specialty has a derived **phase** computed from the latest `pipeline_runs.status`:

| `pipeline_runs.status`                   | Phase            | Badge color |
|------------------------------------------|------------------|-------------|
| (no runs)                                | `not_started`    | gray        |
| `running` + preprocessing stages active  | `preprocessing`  | blue        |
| `awaiting_preprocessing_approval`        | `preprocessing`  | blue        |
| `mapping`                                | `mapping`        | purple      |
| `consolidating`                          | `consolidating`  | yellow      |
| `completed`                              | `completed`      | green       |
| `failed` / `cancelled`                   | `failed`         | red         |

Shared module `src/lib/phase.ts`: `derivePhase()` + `PHASE_LABEL`/`PHASE_COLOR` maps. Used by home-page card chip, specialty-header badge, and pipeline dashboard.

### Home-page specialty card

`src/app/planning/_components/specialty-card.tsx` gets a second DS `Badge` under the existing backend-source badge, color-coded by phase. Requires joining each specialty with its latest pipeline run at the data layer — new function `listSpecialtiesWithPhase()` in `src/lib/data/specialties.ts` (still `'use cache'`, `cacheTag('specialties', 'pipeline:<slug>')`).

### Specialty header badge

`src/app/planning/_components/specialty-header.tsx` gets a second DS `Badge` in the same `Inline` as the backend badge (e.g. `[Neon Postgres] [Mapping]`). Same `derivePhase()` + colors.

### Pipeline tab + dashboard route

Tab entry: `src/app/planning/_components/specialty-tabs.tsx` — insert `{ label: 'Pipeline', segment: 'pipeline' }` right after Overview (so it's prominent).

Route: `src/app/planning/[specialty]/pipeline/page.tsx` — server component. Fetches:
- `getCurrentPipelineRun(slug)` — most recent non-terminal run; else latest terminal one.
- `listPipelineStages(run.id)` if a run exists.
- `listPipelineRuns(slug)` — history.

Data layer (`src/lib/data/pipeline.ts`) — all `'use cache'`, `cacheTag('pipeline:<slug>')`, **`cacheLife('seconds')`** so status updates mid-run are fresh without excessive invalidation.

### Layout — **checklist**, not carousel

Decision: checklist. Rationale: preprocessing runs two parallel stages (must be visible simultaneously), approval gates must be impossible to miss, pipeline state is the CI/dashboard idiom — not an onboarding flow. Carousel would hide non-current stages.

```
┌───────────────────────────────────────────────────────────────┐
│ Pipeline    Phase: [Mapping]       [Start new run ▶]          │
├───────────────────────────────────────────────────────────────┤
│ ▼ Preprocessing                                               │
│   ┌─ Extract codes ──────┐  ┌─ Extract milestones ─────────┐  │
│   │ [awaiting_approval]  │  │ [completed]                  │  │
│   │ 12 extracted         │  │ 2 milestones                 │  │
│   │ [Approve] [Reject]   │  │                              │  │
│   └──────────────────────┘  └──────────────────────────────┘  │
├───────────────────────────────────────────────────────────────┤
│ ▼ Mapping                                                     │
│   ┌─ Map codes ───────────────────────────────────────────┐   │
│   │ [pending]  Runs after preprocessing is approved       │   │
│   └───────────────────────────────────────────────────────┘   │
├───────────────────────────────────────────────────────────────┤
│ ▼ Suggestion Consolidation                                    │
│   ┌─ primary ─┐ ┌─ articles (secondary) ─┐ ┌─ sections (sec.)─│
│   │ [pending] │ │ [pending]              │ │ [pending]        │
│   └───────────┘ └────────────────────────┘ └──────────────────│
├───────────────────────────────────────────────────────────────┤
│ ▼ Past runs                                                    │
│   · wrun_xxx  started 2026-04-22 14:02   status: completed     │
│   · wrun_yyy  started 2026-04-21 09:13   status: failed        │
└────────────────────────────────────────────────────────────────┘
```

When no run exists: the three phase groups still render (all stages `pending`), and the "Start new run" CTA opens the URL form.

### Components

- `PhaseGroup` — heading + children layout (DS `Stack` + `Columns` for side-by-side cards)
- `StageCard` — DS `Card` with: name, status badge, summary text (from `outputSummary`), primary CTA button, error message if failed
- `StartRunForm` (`'use client'`) — textarea for URLs (one per line), optional textarea for system prompt override, Submit. POSTs `/api/workflows/extract` (extract-codes only for now). Shows inline success banner with run id + approval token.
- `ApproveButton` (`'use client'`) — POSTs `/api/workflows/approve` with `{ runId, stage, approved, approvedBy?, note? }`. `router.refresh()` on success.
- `RunHistory` — simple list of past runs with status badges.

### CTA matrix (per-stage primary action)

| Status              | Primary CTA                 | Extra                         |
|---------------------|-----------------------------|-------------------------------|
| `pending` (idle)    | — (top-of-page "Start run") | shows dependency note          |
| `pending` (active)  | —                           | "waiting on upstream"          |
| `running`           | — (spinner)                 | link to observability          |
| `awaiting_approval` | **Approve** / Reject         | summary counts                 |
| `completed`         | View results                | link to Codes tab              |
| `failed`            | Retry                       | error message                  |

### New API route in this step

`POST /api/workflows/approve` — body `{ runId: string, stage: 'extract_codes' | 'extract_milestones', approved: boolean, approvedBy?: string, note?: string }`. Calls `resumeHook(approvalToken(runId, stage), payload)`, then `revalidateTag('pipeline:<slug>', 'max')`. Full `/api/workflows/run` orchestrator still waits for Step 7.

### Revalidation points

- `POST /api/workflows/extract` → `revalidateTag('pipeline:<slug>', 'max')` + `revalidateTag('specialties', 'max')` (home chips).
- `POST /api/workflows/approve` → `revalidateTag('pipeline:<slug>', 'max')`.
- Mid-workflow status updates (inside steps) rely on `cacheLife('seconds')` — no server-side revalidate from within the workflow sandbox.

### Form input defaults (no explicit user call)

- **URLs**: textarea, one URL per line. Simple, copy-paste-friendly, no JS complexity.
- **One URLs field feeds both stages**: matches n8n's single `content_outline_links` column. Form stores the URLs on `pipeline_runs`, both extract-codes and extract-milestones read them. Split later if needed.
- **Post-submit UX**: stay on the Pipeline tab, refresh via `router.refresh()` so the new run's stage cards appear inline. No redirect to a per-run detail page.

### Scope cuts deferred to follow-up

- File upload via Vercel Blob (URLs only this pass).
- Skip-stage / cancel-run actions.
- Deep-links to `npx workflow web` URLs.
- Per-run detail drill-down page (UI reads stages inline on the tab).
- Editing a run's URLs after start.

---

## Step 8b: live progress log + per-call metrics

### Context

Real Gemini extraction runs take minutes and fans out N parallel API calls per stage. The current UI only shows stage status + aggregate counts — no per-API-call visibility, no timing, no cost. Users want a "Log" panel on each stage that streams events as they happen: "identify modules for url X started", "…completed in 3.2s, $0.02, 1200 tokens", etc. Per-stage totals (API calls, duration, cost) also surface at the card's summary level.

### Decision: DB-backed events, not workflow streams

Two designs considered:
- Vercel Workflow namespaced streams (`getWritable()`/`getReadable()`) — native, durable, resumable; requires SSE or direct-stream consumer on the UI side.
- **Chosen**: Persist events to a `pipeline_events` table; existing 2s polling on the Pipeline tab picks them up.

The DB approach fits the current cached-components + polling architecture without new transport. We can migrate to workflow streams later if the event volume gets heavy.

### Schema migration `0004_pipeline_events`

New table:

```
pipeline_events
  id         uuid pk default gen_random_uuid()
  runId      uuid fk → pipeline_runs.id cascade
  stage      text                -- stage name (extract_codes, etc.)
  level      text                -- 'info' | 'warn' | 'error'
  message    text                -- human-readable line
  metrics    jsonb               -- { durationMs, inputTokens, outputTokens, reasoningTokens, cachedInputTokens, costUsd, model, url?, category? }
  createdAt  timestamp default now()
  index on (runId, stage, createdAt)
```

### Pricing module

`src/lib/workflows/lib/pricing.ts`:

```ts
const MODEL_PRICES: Record<string, { inputPerMillion: number; outputPerMillion: number; reasoningPerMillion?: number }> = {
  // USD per 1M tokens — fill in when Gemini 3.1 Pro preview rates are published.
  // 'gemini-3.1-pro-preview': { inputPerMillion: 1.25, outputPerMillion: 10, reasoningPerMillion: 10 },
};

export function estimateCostUsd(model: string, usage: { inputTokens?: number; outputTokens?: number; reasoningTokens?: number }): number | null {
  const p = MODEL_PRICES[model];
  if (!p) return null;
  const input = (usage.inputTokens ?? 0) * p.inputPerMillion / 1_000_000;
  const output = (usage.outputTokens ?? 0) * p.outputPerMillion / 1_000_000;
  const reasoning = (usage.reasoningTokens ?? 0) * (p.reasoningPerMillion ?? p.outputPerMillion) / 1_000_000;
  return input + output + reasoning;
}
```

When a model's price isn't in the table, cost shows as `—` in the UI but tokens still display. Table is a single source of truth — easy to update later.

### Event logging step

`src/lib/workflows/lib/events.ts`:

```ts
export async function logEvent(input: {
  runId: string;
  stage: StageName;
  level: 'info' | 'warn' | 'error';
  message: string;
  metrics?: Record<string, unknown>;
}) {
  'use step';
  // Insert into pipeline_events.
}
```

Called from within other `"use step"` functions (it's the natural pattern — they have full Node access, can call DB writes directly, so instead of wrapping we can just inline event inserts. But making it a step gives retry semantics and participates in the event log. Prefer the step form).

### Gemini step instrumentation

Update `identifyModulesForUrl` and `extractCodesForCategory` in `src/lib/workflows/lib/gemini.ts`:

- Wrap each `generateText` call in `{ runId, stage }`-aware logging:
  - Before call: emit `info` event `"Phase 1: identify modules for <url>"`
  - After success: extract `result.usage`, compute `costUsd`, emit `info` with `metrics: { durationMs, inputTokens, outputTokens, reasoningTokens, cachedInputTokens, costUsd, model, url }`
  - On thrown error (after retries): emit `error` with message
- Both steps gain new inputs: `runId`, `stage` — so the logger knows where to write.

### Stage summary enrichment

At `markStageAwaitingApproval` time (in `extract-codes.ts`), aggregate:
- `apiCalls: phase1Count + phase2Count`
- `durationMs: wall-clock from markStageRunning → now`
- `costUsd: sum of all event metrics.costUsd`
- `inputTokens` / `outputTokens` / `reasoningTokens`: sums

These go into `outputSummary` (already a jsonb field on pipeline_stages). The StageCard's existing summary parser can pick them up.

### Data layer

`src/lib/data/pipeline.ts`:

```ts
export async function listPipelineEvents(runId: string, slug: string): Promise<PipelineEventRow[]> {
  'use cache';
  cacheTag(`pipeline:${slug}`);
  cacheLife('seconds');
  return db.select().from(pipelineEvents).where(eq(pipelineEvents.runId, runId)).orderBy(asc(pipelineEvents.createdAt));
}
```

### UI: log drawer on StageCard

Add a new "Log" section in the expanded StageCard details (client component, already expandable):
- Header: `"Log · N events"`
- Scrollable list of events (max-height ~300px, oldest at top):
  - `[HH:MM:SS] <icon for level> <message>` · `<metrics if any: "3.2s · $0.02 · 1.2k tokens">`
- Auto-refreshes via the existing 2s polling (no new transport needed).

Stage summary row at the top of the card (below status badge) already shows `"N extracted · N modules · N PDFs"`. Add a second line: `"N API calls · Xs · $Y.YY · Ntokens"` when available.

### Blob error polish (follow-up from earlier report)

`src/app/api/blob/upload-token/route.ts`: wrap `handleUpload` in a check for `BLOB_READ_WRITE_TOKEN`. If missing, return `501 { error: 'Vercel Blob not configured. Provision Blob storage and run \`vercel env pull .env.local\`.' }`. UI already surfaces the error text — the better message improves UX without any client change.

### Files to create / modify

- `src/lib/db/schema.ts` — `pipelineEvents` table (+ migration `0004_pipeline_events`)
- `src/lib/workflows/lib/events.ts` — `logEvent` step
- `src/lib/workflows/lib/pricing.ts` — price table + `estimateCostUsd`
- `src/lib/workflows/lib/gemini.ts` — instrument both phase steps, accept `runId`/`stage` inputs, emit events
- `src/lib/workflows/preprocessing/extract-codes.ts` — pass `runId`/`stage` to gemini steps; aggregate stage summary with totals
- `src/lib/data/pipeline.ts` — `listPipelineEvents`
- `src/app/planning/[specialty]/pipeline/_components/stage-card.tsx` — Log section in expanded details; extended summary line
- `src/app/api/blob/upload-token/route.ts` — clearer "Blob not configured" error

### Build order

1. Schema + migration (events table).
2. `events.ts` step + `pricing.ts` table.
3. Instrument gemini.ts (runId/stage propagation + logging calls).
4. extract-codes aggregation of totals into `outputSummary`.
5. `listPipelineEvents` data layer fn.
6. StageCard Log section + extended summary.
7. Blob error polish.

### Verification

- With `GOOGLE_GENERATIVE_AI_API_KEY` set, kick a new extract-codes run on a small PDF.
- Open the Log on the extract_codes card while it runs.
- See events tick:
  - `[HH:MM:SS] ℹ Phase 1: identify modules for <url>`
  - `[HH:MM:SS] ℹ Phase 1 done · 3.2s · $0.02 · 1.2k tokens`
  - `[HH:MM:SS] ℹ Phase 2: extract codes for (<url>, Module A)` × N
  - `[HH:MM:SS] ℹ Phase 2 done · 4.8s · $0.08 · 3.4k tokens` × N
- After stage completes, stage card summary shows: `12 API calls · 45s · $0.37 · 18k tokens`.
- Upload a PDF without `BLOB_READ_WRITE_TOKEN` set → UI shows "Vercel Blob not configured" inline instead of raw SDK error.

---

## Env & deps

### `package.json`
```
dependencies:
  workflow            (latest)
  @workflow/ai        (latest)
  @workflow/next      (latest)
  ai                  ^6 (v6 — see docs)
  @ai-sdk/google      (for Gemini)
  @ai-sdk/react       (if client streaming needed later)
```

### `next.config.ts`
Wrap export with `withWorkflow` from `workflow/next`.

### `src/env.ts` — add to server schema (all optional so the app still boots without them; workflows throw at runtime if missing):
```
AMBOSS_MCP_URL             z.string().url().optional()
AMBOSS_MCP_TOKEN           z.string().optional()
GOOGLE_GENERATIVE_AI_API_KEY  z.string().optional()
BLOB_READ_WRITE_TOKEN      z.string().optional()    // for Vercel Blob if we go that route
```

### `.env.example`
Document each with placeholder + note "workflows fall back to stubs when unset — the durability layer still works."

---

## Critical files to create/modify

- `package.json` — add deps
- `next.config.ts` — wrap with `withWorkflow`
- `src/env.ts` — new env vars
- `src/lib/db/schema.ts` — add `specialties.milestones`, `pipeline_runs`, `pipeline_stages`, `extracted_codes` (+ migration via `npm run db:generate` then `db:migrate`). Step 4 adds `specialties.region/language/contentOutlineUrls/extractionSystemPrompt/milestonesSystemPrompt` (migration `0002_specialty_region`).
- `src/lib/workflows/lib/{gemini,amboss-mcp,db-writes,approval,util}.ts` — `util.ts` added in Step 4 with `chunk<T>()`. `gemini.ts` extended with `identifyModulesForUrl` + `extractCodesForCategory`.
- `scripts/import-board-mapping.ts` — parses `board_specialty_mapping_competencies.xlsx` (tabs `master` + `us` + `de`), upserts specialties with region/URLs/prompts. Idempotent.
- `scripts/start-extract.ts` — ad-hoc dev helper: `tsx scripts/start-extract.ts <slug>` opens a pipeline run, calls `start(extractCodesWorkflow, [...])`, prints runId + hook token.
- `src/lib/workflows/preprocessing/{extract-codes,extract-milestones,index}.ts`
- `src/lib/workflows/run-pipeline.ts` (orchestrator stub — real stages wired as we go)
- `src/app/api/workflows/{run,approve,status}/route.ts`
- `src/app/planning/[specialty]/pipeline/page.tsx` + `_components/*`
- `src/app/planning/_components/specialty-tabs.tsx` — add Pipeline tab
- `src/lib/data/pipeline.ts` — new cached data fns for the UI

Reuse: `getDb()` from `src/lib/db/index.ts`; Drizzle schema types; existing Zod types from `src/lib/repositories/types.ts` for code shape; DS patterns from `src/app/planning/_components/*` for the new dashboard cards.

---

## Build order

1. **Deps + env + next.config wrap** — smoke test: `npm run dev` still boots, `npx workflow health` answers OK. ✅ done
2. **Schema additions + migration** — `specialties.milestones`, `pipeline_runs`, `pipeline_stages`, `extracted_codes`. ✅ done
3. **`src/lib/workflows/lib/*`** — approval/db-writes/gemini/amboss-mcp scaffolding with stubs. ✅ done
4. **Region model + import script + two-phase extract-codes workflow** (this step):
   - **4a**. Schema migration `0002_specialty_region`: add `region`, `language`, `contentOutlineUrls`, `extractionSystemPrompt`, `milestonesSystemPrompt` to `specialties`. Run `db:generate` + `db:migrate`.
   - **4b**. `scripts/import-board-mapping.ts`: parse `board_specialty_mapping_competencies.xlsx`, upsert specialties with region/URLs/prompts. Run it to populate the registry.
   - **4c**. Extend `src/lib/workflows/lib/gemini.ts` with `identifyModulesForUrl` + `extractCodesForCategory` stubs. Add `src/lib/workflows/lib/util.ts` with `chunk`.
   - **4d**. Write `src/lib/workflows/preprocessing/extract-codes.ts` — two-phase parallel workflow, approval hook, promotion.
   - **4e**. Smoke via `curl` (API routes aren't built yet, so start from a scratch `scripts/start-extract.ts` that calls `start(extractCodesWorkflow, ...)` for one specialty). Verify with `npx workflow web <runId>`.
5. **`extract-milestones` workflow** — same shape, single-phase, writes draft.
6. **`preprocessing/index.ts`** parallel orchestrator + `run-pipeline.ts` top-level stub.
7. **API routes** `/api/workflows/{run,approve,status}`.
8. **Pipeline dashboard UI** — stage cards + approve buttons wired.
9. **End-to-end smoke**: start a run from the UI → preprocessing parallel kicks → approve both stages → run transitions to mapping placeholder (no-op for now).
10. **PAUSE** — user hands over n8n mapping workflow JSON → flesh out `map-codes.ts` with real Gemini + AMBOSS MCP + parallelization.
11. Repeat for consolidation stages.

Each numbered step ends with `npm run typecheck && npm run lint` clean.

---

## Verification

**After step 2 (schema)**
- `npm run db:migrate` applies cleanly.
- `tsx scripts/verify-db.ts` shows `pipeline_runs`, `pipeline_stages`, `extracted_codes` tables with row count 0.

**After step 4 (region model + extract-codes, stubbed)**
- `npm run db:migrate` applies `0002_specialty_region` cleanly.
- `npm run tsx scripts/import-board-mapping.ts` upserts specialties with `region`/`language`/`contentOutlineUrls`/`extractionSystemPrompt`/`milestonesSystemPrompt`. Re-runnable without duplicates.
- `SELECT slug, region, language, jsonb_array_length(content_outline_urls) FROM specialties;` shows expected rows (anesthesiology + any from us/de tabs).
- `npm run tsx scripts/start-extract.ts anesthesiology` kicks a workflow. `npx workflow web <runId>` shows two Gemini step tiers (Phase 1: N identify-modules steps; Phase 2: N×M extract-codes steps) — all cache-hit on replay. Stub output writes N×M×2 rows to `extracted_codes`. Run status goes `running` → `awaiting_approval` on `extract_codes` stage.
- Resume via `curl -X POST http://localhost:3000/.well-known/workflow/v1/resume-hook -d '{"token":"approve:<runId>:extract_codes","payload":{"approved":true,"approvedBy":"bsk"}}'` (or equivalent) → workflow completes, staged rows flow into `codes` table with null mapping fields.
- Kill dev server during await-approval → restart → resume still works.

**After step 8 (dashboard wired, stubs in place)**
- Navigate to `/planning/anesthesiology/pipeline` — three category groups render, all stages show `pending`.
- POST `/api/workflows/run` with `{ slug: "anesthesiology" }` → returns `{ runId, workflowRunId }`.
- Dashboard refresh shows preprocessing stages transitioning `running` → `awaiting_approval` (stub Gemini returns in < 1s).
- Click "Approve" on `extract_codes` → status → `completed`. Same for milestones.
- Overall pipeline status → `mapping`. Mapping stage still `pending` (placeholder).
- `npx workflow web <runId>` opens the Observability dashboard showing the step tree.
- Kill dev server during the await-approval pause → restart → approval still works (durability check).

**After step 10 (real mapping wired)**
- Same flow, but with `GOOGLE_GENERATIVE_AI_API_KEY` + `AMBOSS_MCP_TOKEN` set → real LLM + MCP calls.
- Verify parallelization: time 100 codes with concurrency=10 → should be ~10× faster than sequential.
- Kill mid-mapping at code 50 → restart → resume at 51 (step cache replays earlier codes as cache hits).

**Out of scope for this track**
- Auth gating (`/api/workflows/*` unauthenticated until Track C).
- Replacing n8n for currently-seeded anesthesiology — we add new runs alongside the existing seeded data; later migrations can clear-and-reseed.
- Queue-based scheduling (Vercel Queues) — direct `start()` from the API route is fine.
- Per-code editor review during mapping — deferred; approval happens at stage boundaries only.

---

## Decisions made (defaults; user can override before step 1)

1. **PDF source** → Vercel Blob.
2. **Trigger** → UI button on Pipeline tab (API route also callable from CLI).
3. **Editor-in-the-loop pauses** → yes, at the two preprocessing stage boundaries (explicit user request). No mid-mapping pauses. No consolidation pauses for now.
4. **Milestones** → in scope (explicit user request).
5. **Stubs for Gemini + MCP** → yes, so steps 1–9 are shippable without creds.
6. **Concurrency cap for mapping** → 10 to start; tune based on rate limits.
