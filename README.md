# amboss-content-planner-ui

Internal AMBOSS staff tool for planning medical-content coverage per specialty. Editors trigger durable, multi-stage AI pipelines that extract clinical concepts from board-review PDFs, map them against existing AMBOSS articles, and consolidate gaps into editorial decisions.

> **New here?** Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system overview, module map, and conventions. Read [`AGENTS.md`](AGENTS.md) for design-system + repo-specific tips.

---

## Quickstart

### 1. Install + provision

```bash
npm install
cp .env.example .env.local        # then fill in secrets — see below
```

Provision local services (one time):

```bash
# Convex — runs codegen and writes NEXT_PUBLIC_CONVEX_URL into .env.local
npx convex dev                    # leave running, or run with --once

# Convex Auth keypair (one per deployment)
node scripts/generate-auth-keys.mjs > /tmp/keys.env
set -a; source /tmp/keys.env; set +a
npx convex env set -- JWT_PRIVATE_KEY "$JWT_PRIVATE_KEY"
npx convex env set -- JWKS "$JWKS"
npx convex env set SITE_URL http://localhost:3000
rm /tmp/keys.env

# Service token shared between Next + Convex (used by workflows + scripts)
SECRET=$(openssl rand -hex 32)
npx convex env set WORKFLOW_SECRET "$SECRET"
echo "WORKFLOW_SECRET=\"$SECRET\"" >> .env.local
```

### 2. Run

```bash
npm run dev                       # http://localhost:3000
```

Sign in is restricted by `STAFF_EMAIL_ALLOWLIST` (Convex env) or, when unset, the legacy AMBOSS-domain whitelist. See [auth model](docs/ARCHITECTURE.md#auth-model).

### 3. Seed data (optional)

```bash
npm run seed:convex                  # editor tables from xlsx fixtures
npm run seed:ontology                # ICD-10 / HCUP / ABIM / Orpha
npm run import-board                 # specialty registry
```

See `package.json#scripts` for the full list and [`docs/ARCHITECTURE.md#scripts`](docs/ARCHITECTURE.md#scripts-scripts) for what each does.

---

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (also runs Convex codegen) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Biome check |
| `npm run lint:fix` | Biome check + write fixes |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright |
| `/security-review` | Local security review of pending changes (Claude Code slash command) |

CI runs typecheck + lint + test + e2e + an [AI security review](.github/workflows/security-review.yml) on every PR.

---

## Deployment

Zero-config on Vercel. The Convex deployment is auto-managed by the Vercel ↔ Convex integration; on each Vercel build, `npx convex deploy` runs against the connected deployment.

Required environment variables — see [`docs/ARCHITECTURE.md#auth-model`](docs/ARCHITECTURE.md#auth-model) for the full list and where each one goes (Vercel vs. Convex).

---

## Repo conventions

- **Default to server components.** Mark `'use client'` only when needed — see `AGENTS.md` for design-system caveats.
- **Convex is the source of truth.** Browser + RSC use it via `useQuery` / `preloadQueryAsUser`; workflow runtime uses it with the shared `WORKFLOW_SECRET`. See the [auth boundary checklist](docs/ARCHITECTURE.md#auth-boundary-checklist) before adding new functions.
- **Workflows for anything multi-step or LLM-bound.** `'use workflow'` for the top-level fn, `'use step'` for retryable substeps. See [workflow flow](docs/ARCHITECTURE.md#workflow-flow-write--approval).
- **No string-blob columns for new data.** LLM output that uses natural-language keys must be transformed to array-of-records before storage. See [LLM-output normalization](docs/ARCHITECTURE.md#llm-output-normalization).

---

## Project status

The codebase is mid-2026 internal-tool stage: post-launch foundations are landing (auth + audit + rate-limit + dependency hygiene), and the next phase is cleanup before adding **literature search → PDF curation → article generation** workflows. See [`docs/ARCHITECTURE.md#future-modules`](docs/ARCHITECTURE.md#future-modules) for the module placeholders.
