<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:amboss-design-system -->
# @amboss/design-system

This project uses `@amboss/design-system` (v3.42.0) for UI. Import everything from the package root:

```ts
import { Button, Card, Text, light, ThemeProvider } from '@amboss/design-system';
```

## Authoritative docs (version-pinned to scaffold time)

- `docs/amboss/llms-full.txt` — full component + token reference (scraped from the DS site at scaffold time, ~320 KB). **Read this before composing UI.**
- `docs/amboss/llms.txt` — shorter index with Storybook URLs per component.
- `docs/amboss/SOURCE.md` — scrape timestamp + installed DS version + refresh commands.

Live docs (network, always current): https://design-system.miamed.de/

## Key facts

- The DS is **Emotion-based**, not Tailwind. Styling goes through the ThemeProvider + component props.
- SSR is wired via `src/app/emotion-registry.tsx` (Emotion cache + `useServerInsertedHTML`). Do not remove it.
- All components are client-only. Pages that use DS components must be marked `'use client'`.
- Peer deps installed: `@emotion/react`, `@emotion/styled`, `@emotion/cache`, `@emotion/is-prop-valid`, `emotion-theming`.

Do not derive component APIs from training data — `docs/amboss/llms-full.txt` is authoritative for the installed DS version.

## Extension points

- **Auth**: `src/lib/auth/index.ts` exports a stub `getCurrentUser()` returning `null`. Wire your identity provider here. For request-time gating in Next.js 16, add `src/proxy.ts` (the renamed middleware).
- **Database**: `src/lib/db/index.ts` exports a stub `db`. Declare the client (Drizzle/Prisma/Kysely) there so server code imports from one place.
- **Env vars**: Declare in `src/env.ts` under `server` or `client` schemas; `next.config.ts` imports it so builds fail fast on missing vars. Local overrides go in `.env.local` (see `.env.example`).
- **Deployment**: Zero-config on Vercel (`vercel deploy`). `@vercel/analytics` and `@vercel/speed-insights` are already rendered from the root layout — inert off-platform, active on deploy.
<!-- END:amboss-design-system -->

