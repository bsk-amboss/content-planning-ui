# Architecture

Single source of truth for how this app is structured, what each layer is responsible for, and where new features slot in. Read this before adding anything bigger than a one-file change.

> Companion docs: [`AGENTS.md`](../AGENTS.md) (design-system + repo conventions for editors), [`docs/amboss/llms-full.txt`](amboss/llms-full.txt) (DS component reference). For ad-hoc security review, see `/security-review` (slash command) or the GitHub Action on every PR.

---

## What this is

An internal AMBOSS staff tool for planning medical-content coverage **per specialty**. Editors trigger durable, multi-stage AI pipelines that:

1. Extract a specialty's clinical concepts ("codes") from board-review PDFs and milestone documents.
2. Map each code against the existing AMBOSS library to identify coverage gaps.
3. Consolidate the gaps into article-level / section-level decisions (new, update, or sufficient).
4. *(Planned)* Drive a literature-search → PDF-curation → article-generation pipeline for the gaps.
5. *(Planned)* Surface progress + cost across specialties in dashboards.

Workflows are **durable** (crash-safe, resumable), **human-gated** at every approval boundary, and **per-specialty siloed**.

---

## High-level architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Browser (React 19, Convex live queries, @amboss/design-system)           │
│   └── /login, /planning/[specialty]/<codes|articles|sections|...>        │
└────────────┬─────────────────────────────────────────────────────────────┘
             │ user JWT cookie  (Convex Auth, Password + OTP)
             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Next.js (Vercel Functions, Fluid Compute) — RSC + route handlers          │
│   ├── proxy.ts           sign-in gate on GET (non-GET = handler-gated)    │
│   ├── api/workflows/*    triggers + lifecycle for pipeline runs           │
│   ├── api/blob/*         Vercel Blob upload tokens                        │
│   ├── api/internal/*     workflow ↔ Next bridge (cache invalidation)      │
│   └── lib/{auth, convex/server, data}  user-token Convex wrappers         │
└──────┬──────────────────────────────────────────┬────────────────────────┘
       │ user token                                │ start(workflow, …)
       ▼                                           ▼
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│ Convex (typed server + DB)       │◀───▶│ Vercel Workflow runtime          │
│  • specialties / codes / …       │ _secret  • extractCodesWorkflow         │
│  • pipelineRuns / stages / events│      │  • extractMilestonesWorkflow    │
│  • ontology / amboss library     │      │  • mapCodesWorkflow             │
│  • auth (users, sessions)        │      │  • [planned] literatureSearch   │
│  • otpRateLimit                  │      │  • [planned] generateArticle    │
└──────────────┬──────────────────┘     └──────────────┬──────────────────┘
               │                                        │
               │                                        ▼
               │                          ┌─────────────────────────────┐
               │                          │ External LLMs / APIs         │
               │                          │  • Gemini (extract, map)     │
               │                          │  • Anthropic (mapping ladder)│
               │                          │  • Resend (OTP email)        │
               │                          │  • AMBOSS MCP (article IDs)  │
               │                          └─────────────────────────────┘
               ▼
       ┌──────────────────┐
       │ Vercel Blob       │   PDF binaries (planned for literature/pdfs)
       └──────────────────┘
```

**Two callers, one Convex API.** Authentication is the shared currency: every public Convex function accepts either a user JWT (browser + RSC) or a `_secret` arg matching `WORKFLOW_SECRET` (workflow runtime + CLI scripts). See [Auth model](#auth-model).

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 16 App Router + Cache Components | RSC defaults, PPR, edge-friendly without going edge-only |
| UI components | `@amboss/design-system` (Emotion-based) | Org-mandated; forces `'use client'` wherever used |
| Backend / DB | Convex | Reactive queries, typed end-to-end, integrated auth |
| Auth | `@convex-dev/auth` (Password + Email OTP) | Same DB as everything else; no third-party sync |
| Long-running pipelines | Vercel Workflow DevKit | Crash-resumable, step-cached, pause/resume hooks |
| LLMs | Vercel AI SDK v6 + Gemini / Anthropic | Structured output, tool use, AMBOSS MCP integration |
| Blob storage | Vercel Blob | PDF uploads (currently for input PDFs; future for ingested literature) |
| Tests | Vitest (unit) + Playwright (e2e) | |
| Lint / format | Biome | One tool, fast |
| Env validation | `@t3-oss/env-nextjs` (Zod) | Builds fail on missing/malformed env |

---

## Module map

### Convex (`convex/`)

Domain-flat layout. Each domain owns its queries + mutations + (workflow-callable) writes in one file.

| File | Responsibility |
|---|---|
| `_lib/access.ts` | `requireUser`, `requireUserOrService`, `requireService` — auth helpers + `serviceSecretArg` validator |
| `auth.ts` / `auth.config.ts` | Convex Auth setup + email-allowlist gate |
| `http.ts` | Routes for `/api/auth/*` handshake |
| `users.ts` | Current-user query |
| `specialties.ts` | Specialty registry |
| `codes.ts` | Per-specialty clinical concepts + mapping fields |
| `categories.ts` | Code-category groupings |
| `articles.ts` | Consolidated / new / update article suggestions |
| `sections.ts` | Consolidated section suggestions |
| `ontology.ts` | ICD-10 / HCUP / ABIM / Orpha lookups (read-only) |
| `amboss.ts` | Local mirror of AMBOSS article + section IDs |
| `sources.ts` | Source-slug registries (codes + milestones) |
| `pipeline.ts` | Runs, stages, events, extracted-codes staging |
| `overview.ts` | Per-specialty count rollups |
| `ResendOTP.ts` / `ResendOTPPasswordReset.ts` | Email-OTP providers (rate-limited) |
| `otpRateLimit.ts` | Internal rate-limit counter |
| `schema.ts` | All Convex tables + indexes |

**Future slots** (`// TODO`): `literature.ts`, `pdfs.ts`, `drafts.ts`, `dashboard.ts`. See [Future modules](#future-modules).

### Next.js (`src/app/`)

```
src/app/
  layout.tsx                          root, providers, security headers
  page.tsx                            home grid (specialty cards)
  login/page.tsx                      sign-in / sign-up / OTP / reset
  planning/
    [specialty]/
      page.tsx                        specialty overview
      layout.tsx                      tab shell
      codes/                          codes table (Convex live)
      articles/                       article suggestions tabs
      sections/                       section suggestions tab
      milestones/                     milestone-extraction artifacts
      categories/                     code categories
      sources/                        per-source views (ICD-10, …)
      pipeline/                       pipeline dashboard
  api/
    workflows/{extract,extract-milestones,map-codes,remap-code,
                approve,cancel,reset-stage,clear-stale-runs}
    blob/upload-token                 Vercel Blob token issuance
    codes/[specialty]/[code]          per-code edits + run metadata
    internal/revalidate               workflow → Next cache bridge
    debug/sheet-schema                dev-only sheet inspection
  proxy.ts                            sign-in gate (Next 16 middleware)
```

**Future slots:** `planning/[specialty]/literature/`, `planning/[specialty]/pdfs/`, `planning/[specialty]/drafts/`, `dashboard/`.

### Workflows (`src/lib/workflows/`)

```
lib/
  approval.ts            deterministic hook tokens (approve:<runId>:<stage>)
  db-writes.ts           every Convex write goes through these step fns
  events.ts              logEvent + aggregate metrics
  reset.ts               cascade reset across stages
  revalidate.ts          POST → /api/internal/revalidate
  gemini.ts              extract / map / milestone Gemini calls
  amboss-mcp.ts          AMBOSS MCP tool client (mapping)
  pricing.ts             token → $ for cost rollups
  prompts.ts             default system prompts
preprocessing/
  extract-codes.ts       'use workflow' — phase 1 + 2 over PDF URLs
  extract-milestones.ts  'use workflow' — milestone summarisation
mapping/
  map-codes.ts           'use workflow' — coverage analysis per code
```

**Future slots:** `literature/search.ts`, `drafting/generate-article.ts`.

### Scripts (`scripts/`)

CLI tools run locally with `npm run <script>`. All authenticate to Convex via `_lib/convex.ts` which injects `WORKFLOW_SECRET`.

| Script | Purpose |
|---|---|
| `seed-convex.ts` | Seed editor tables from xlsx fixtures |
| `seed-from-xlsx.ts` | Seed ontology tables (ICD-10 / HCUP / ABIM / Orpha) |
| `import-board-mapping.ts` | Import specialty registry rows from board xlsx |
| `import-milestones.ts` | Write milestone text from a file into a specialty |
| `mark-imported.ts` | Backfill synthetic completed runs after manual import |
| `refresh-amboss-library.ts` | Re-mirror AMBOSS article + section IDs |
| `wipe-prod.ts` | One-shot wipe of every Convex table (dev only) |
| `start-extract.ts` | Trigger a workflow run from the CLI |
| `generate-auth-keys.mjs` | Mint JWT keypair for Convex Auth |

### Shared `src/lib/`

| Path | Responsibility |
|---|---|
| `auth/` | `getCurrentUser`, `isAuthenticated`, `requireUserResponse` |
| `convex/server.ts` | `fetchQueryAsUser` / `fetchMutationAsUser` / `preloadQueryAsUser` (auto-attach JWT) |
| `data/` | RSC-side typed adapters between Convex shapes and UI types **(scheduled for slimming in Phase A4)** |
| `phase.ts` | Runtime → display-phase mapping for the home grid |

### Domain doc trail

- `convex/schema.ts` — all tables + indexes (split per-domain in Phase B2)
- `src/lib/repositories/` — **legacy multi-backend abstraction; scheduled for deletion in Phase A1**

---

## Auth model

Two callers, one Convex API.

```
┌─ Browser/RSC ─────────────────────┐    ┌─ Workflow runtime / CLI ─────────┐
│ user signs in via Convex Auth      │    │ has WORKFLOW_SECRET env var       │
│ JWT cookie attached to every       │    │ adds _secret: <env> to args       │
│ Convex call                        │    │                                   │
└──────────────┬─────────────────────┘    └────────────────┬──────────────────┘
               │                                            │
               ▼                                            ▼
        ┌──────────────────────────────────────────────────────────┐
        │ Convex public function                                   │
        │   await requireUserOrService(ctx, args._secret)          │
        │     • user JWT present  → allow                          │
        │     • _secret matches WORKFLOW_SECRET → allow            │
        │     • else → throw ConvexError('Unauthorized')           │
        └──────────────────────────────────────────────────────────┘
```

**Required environment variables:**

| Variable | Where set | Purpose |
|---|---|---|
| `WORKFLOW_SECRET` | Vercel (all envs) + Convex (dev + prod) | Service token for workflow / scripts → Convex |
| `INTERNAL_REVALIDATE_SECRET` | Vercel (all envs) | Workflow → `/api/internal/revalidate` cache bust. Required in production. |
| `STAFF_EMAIL_ALLOWLIST` | Convex (prod) | Comma-separated allowlist of sign-in addresses. Falls back to AMBOSS-domain whitelist when unset. |
| `RESEND_API_KEY` | Convex | OTP email transport |
| `JWT_PRIVATE_KEY` / `JWKS` | Convex | Convex Auth signing (one keypair per deployment) |
| `SITE_URL` | Convex | Convex Auth callback URL |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Vercel | Gemini calls in extract/map workflows |
| `ANTHROPIC_API_KEY` | Vercel | Anthropic Opus retry in mapping ladder (optional) |
| `AMBOSS_MCP_URL` / `AMBOSS_MCP_TOKEN` | Vercel | AMBOSS MCP tool endpoint |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Vercel Blob (auto-provisioned by integration) |

**Public Convex URL** (`NEXT_PUBLIC_CONVEX_URL`) is, by design, public. Authorization is enforced **inside** every public Convex function — never assume the URL alone is a security boundary.

---

## Request flow (interactive read)

```
Browser
  │
  │ 1.  GET /planning/anesthesiology/codes
  ▼
proxy.ts (Next 16 middleware)
  │      • method !== GET → fall through (handler-gated)
  │      • !signed-in    → redirect /login?next=…
  │      • signed-in     → continue
  ▼
Next.js RSC page (planning/[specialty]/codes/page.tsx)
  │
  │ 2.  await Promise.all([
  │       getConsolidationLockState(slug),
  │       preloadQueryAsUser(api.codes.list, { slug }),
  │       preloadQueryAsUser(api.codes.inFlight, { slug }),
  │     ])
  │
  │   preloadQueryAsUser → reads convexAuthNextjsToken() cookie
  ▼
Convex
  │   • requireUserOrService(ctx, undefined)   ← user-token path
  │   • returns rows
  ▼
Hydrated client component (CodesViewClient)
  │   • usePreloadedQuery for static initial state
  │   • useQuery(api.codes.inFlight, { slug })  ← live subscription
  ▼
Browser receives initial HTML + Convex WebSocket pushes for updates
```

---

## Workflow flow (write + approval)

```
User clicks "Start extract" in pipeline-dashboard
  │
  ▼
POST /api/workflows/extract  (Next route handler)
  │   • requireUserResponse() — 401 if not signed in
  │   • validate body
  │   • fetchMutationAsUser(api.pipeline.createRun) — records createdByUserId
  │   • start(extractCodesWorkflow, …)               — Vercel Workflow boundary
  ▼
Vercel Workflow runtime (separate sandbox)
  │
  │   Each `'use step'` call ↓ is event-log-cached, retryable, replayable
  │   Every Convex call ↓ passes _secret: WORKFLOW_SECRET
  │
  ├── markStageRunning('extract_codes')
  ├── identifyModulesForUrl(...)        ← Gemini, per PDF URL
  ├── extractCodesForCategory(...)      ← Gemini, per (URL, module)
  ├── writeExtractedCodes(rows)         ← Convex insert (staging)
  ├── markStageAwaitingApproval(...)
  │
  │   ┌────────────────────────────────────────────┐
  │   │ createHook(token = approve:<runId>:<stage>)│   workflow paused
  │   └────────────────────────────────────────────┘
  │                       ▲
  │                       │ resumeHook(token, payload)
  │                       │
  │   ┌────────────────────────────────────────────┐
  │   │ POST /api/workflows/approve                │
  │   │   • getCurrentUser()                       │
  │   │   • approvedBy = user.email (server-stamped)│
  │   │   • resumeHook(approvalToken(runId, stage))│
  │   └────────────────────────────────────────────┘
  │
  ├── promoteExtractedCodesToCodes(...)
  ├── revalidateSpecialtyCache(...)     ← POST /api/internal/revalidate
  └── markStageCompleted(approvedBy)
```

The **approval-hook pattern** (deterministic token, paused workflow, resume from authenticated route) is the same shape we'll reuse for future literature curation + draft review.

---

## Pipeline lifecycle

Each `pipelineRuns` row owns a chain of `pipelineStages`. Status transitions:

```
pipelineRuns:
  running ─┬─→ awaiting_preprocessing_approval ─→ mapping ─→ consolidating ─→ completed
           ├─→ failed
           └─→ cancelled

pipelineStages (per stage in a run):
  pending ─→ running ─┬─→ awaiting_approval ─┬─→ approved ─→ completed
                      │                       └─→ (rejected) ─→ skipped
                      ├─→ failed
                      └─→ skipped
```

**Resetting a stage** (`/api/workflows/reset-stage`) cascades to every downstream stage and clears editor data tied to it. Run status flips to `cancelled` so the dashboard stops treating it as active.

---

## Conventions

### Naming + file layout

- Convex domain files are flat under `convex/` and named for the table they own (`codes.ts` owns `codes`). Workflow-only helpers go in `convex/_lib/`.
- Next.js routes follow App Router. Page-local components go in `_components/` siblings (`_components/` is excluded from routing). Client components end with `.tsx` and start with `'use client'`.
- Workflow code lives under `src/lib/workflows/<phase>/<feature>.ts`. The top-level functions are `'use workflow'`; helpers used inside are `'use step'`.

### Server vs. client

- **Default to server components.** Mark client only when needed (`useState`, browser APIs, Convex `useQuery` subscriptions, design-system components).
- Pages that subscribe to live Convex data use the `preloadQuery` → `usePreloadedQuery` handoff so the first render is server-prepared, then live updates take over.
- Heavy interactive widgets (codes table, pipeline dashboard) live in `_components/`, marked client; their data hydration comes from RSC parents.

### Auth boundary checklist

When you add a new Convex function:

1. **UI-callable + workflow-callable** → `serviceSecretArg` in args, `requireUserOrService(ctx, args._secret)` in handler.
2. **UI-callable only** → `requireUser(ctx)` in handler.
3. **Workflow-only** → `serviceSecretArg` + `requireService(args._secret)`.

When you add a new Next.js API route:

1. **Mutating route** (POST/PATCH/DELETE) → `requireUserResponse()` at the top, returns 401 if missing.
2. **Read route** → relies on `proxy.ts` GET-redirect; no in-handler check needed (but doesn't hurt).
3. **Service route** (workflow → Next, e.g. `internal/revalidate`) → secret check, fail-closed in production.

### Storage choices

| Kind | Storage |
|---|---|
| Structured data + relations | Convex |
| Workflow event log | Convex (`pipelineEvents`) |
| Binary artefacts (PDFs) | Vercel Blob |
| Ephemeral cache state | `runtime-cache` API or Next.js `unstable_cache` |
| Secrets | Vercel env (Next-side) + Convex env (Convex-side) |

### LLM-output normalization

LLM responses sometimes use natural-language strings as object keys (e.g. `{ "Vitamin B₁₂ deficiency": [...] }`). Convex requires ASCII-only field names, so we **never** store these shapes directly. Always transform at the workflow boundary:

```diff
- { "Vitamin B₁₂": ["sec_a"], "Megaloblastic anaemia": ["sec_b"] }
+ [{ articleTitle: "Vitamin B₁₂", sections: ["sec_a"] },
+  { articleTitle: "Megaloblastic anaemia", sections: ["sec_b"] }]
```

Validators on the Convex side enforce this — no string-blob columns for new fields.

---

## Future modules

These are placeholders. Each will get its own architecture-doc section once the feature spec is firm — for now, just know where they slot in.

### `convex/literature.ts` + `src/lib/workflows/literature/search.ts`

```
[approved article/section]
  └─ POST /api/workflows/literature-search
       └─ runs literatureSearchWorkflow
            ├─ webSearch(...) -- TBD provider
            ├─ filterByLicense(...)
            └─ writes literatureCandidates rows (per article/section)
```

Tables: `literatureSearches` (one per article/section, status), `literatureCandidates` (many per search; title, authors, abstract, source URL, license-flag).

### `convex/pdfs.ts` + Blob

```
[user picks candidate]
  └─ drag-drop PDF (or paste URL) → /api/blob/upload-token (already exists)
       └─ Convex pdfDocuments insert
            ├─ blobUrl, sha256
            ├─ metadata: title, authors, journal, year, doi, pubmedId, license, …
            └─ status: pending | reviewed | approved | rejected
```

The metadata schema is shaped by your CMS workflow — to be filled in when that's specced.

### `src/lib/workflows/drafting/generate-article.ts` + `convex/drafts.ts`

```
[approved PDFs for an article topic]
  └─ POST /api/workflows/generate-article
       └─ runs generateArticleWorkflow
            ├─ summarisePdfs(...)
            ├─ assembleAmbossArticle(...)
            ├─ writes articleDrafts row (status=awaiting_approval)
            └─ pauses on approval hook  (same pattern as today's stages)
```

The **review loop is the same shape as today's `awaiting_approval` stages** — workflow paused via `createHook`, dashboard surfaces the draft, human approves/rejects via `/api/workflows/approve-draft`, workflow resumes.

### `convex/dashboard.ts` + `src/app/dashboard/`

Aggregation queries reading from `pipelineRuns`, `pipelineEvents`, `codes`, `consolidatedArticles`, `pdfDocuments`, `articleDrafts`. KPIs surface as live charts using existing Convex live-query infra.

KPIs (starter): codes-mapped %, articles consolidated, sections consolidated, PDFs ingested, articles generated, articles published, pipeline cost (USD), throughput by stage. Refined when dashboards are built.

---

## Where to make changes

| Task | Touch |
|---|---|
| New Convex table + UI tab | `schema.ts` + `convex/<domain>.ts` + `src/lib/data/<domain>.ts` (only if shape translation needed) + `src/app/planning/[specialty]/<feature>/` |
| New workflow stage | `src/lib/workflows/<phase>/<stage>.ts` + new `pipelineStages.stage` constant + UI dashboard card |
| New API route | `src/app/api/<…>/route.ts` + auth guard from [Auth boundary checklist](#auth-boundary-checklist) |
| New script | `scripts/<name>.ts` using `convexClient()` from `scripts/_lib/convex.ts` + `package.json` script entry |
| New env var | `src/env.ts` (Next-side) **and** document here |

---

## Glossary

- **Specialty** — a medical discipline (anesthesiology, dermatology, …) being planned. Most data is keyed by `specialtySlug`.
- **Code** — a clinical concept extracted from board-review or milestone documents (e.g. `ab_anes_0001`). Maps to AMBOSS articles + sections.
- **Mapping** — the LLM-driven decision per code about whether AMBOSS already covers it, and what gaps remain.
- **Consolidation** — merging per-code mapping output into per-article and per-section editorial decisions.
- **Stage** — one step of a pipeline run (`extract_codes`, `extract_milestones`, `map_codes`, `consolidate_*`).
- **Approval hook** — a paused-workflow checkpoint waiting for human approval. Resumed via `/api/workflows/approve` with the deterministic `approve:<runId>:<stage>` token.
- **Run** — one execution of the pipeline for a specialty, end-to-end. Owns N stages and writes to `pipelineEvents`.
