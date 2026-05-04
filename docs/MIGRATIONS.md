# Schema migrations

This project does not use a migration framework. Convex schema is the source
of truth (`convex/schema/*.ts`); when a column type changes, the change
becomes the migration. There are no production users, and the editor data is
fully reproducible from xlsx fixtures + the `extract`/`map`/`consolidate`
workflows, so the standard playbook is **wipe + reseed** rather than
in-place data migration.

## When to migrate

- You changed a Convex validator (`convex/schema/<domain>.ts`).
- You renamed or split a table.
- You changed the on-the-wire shape of a field (e.g. dropped JSON-string
  storage in favour of a typed array — see Phase B2).

## Steps

1. Make the schema change in `convex/schema/<domain>.ts`. Keep the change
   tight — match the new shape on writers (`convex/<domain>.ts` mutations,
   `src/lib/workflows/lib/db-writes.ts`, API routes that previously
   stringified the value) and readers (`src/lib/data/<domain>.ts`, any UI
   that consumed the old shape).

2. Push the schema and regenerate the typed API:

   ```sh
   npx convex codegen        # validates + uploads dev deploy
   npx convex dev --once     # alternative: also restores .env.local pieces
   ```

   If existing rows in dev violate the new validator, the push fails with a
   `Server Error` naming the offending field. Two options:
   - **Wipe the affected tables and reseed** (preferred for ergonomic data).
     The seed script handles editor data; pipeline tables can be wiped from
     the dashboard or via a one-shot mutation.
   - Edit rows by hand from the dashboard if the diff is tiny.

3. Reseed editor data from the xlsx fixtures:

   ```sh
   npm run seed:convex
   ```

   This calls `deleteForSpecialty` per table, then bulk-inserts. The seed
   script normalises whatever the xlsx fixture happens to hold into the
   current validator shape (see `normaliseCodeMappingShape` in
   `scripts/seed-convex.ts` for the example pattern: strip extra keys,
   convert any record-form blobs to the expected array form). When you
   change a validator and the fixture data trips it, extend the normaliser
   rather than mutating the xlsx.

4. Production deploys: the schema validator runs at deploy time, so a
   prod deploy with no compatible migration path will fail. Until there
   are real prod users, the answer is the same: wipe + reseed. When that
   changes, this doc will get a "real migration" section.

## What we explicitly don't do

- **No backwards-compat shims.** Don't dual-read both shapes; don't add a
  fallback path that parses the old encoding. Pick a cutover and ship it.
- **No migration scripts.** A reseed is the migration. If a one-off data
  edit is needed, run a Convex mutation from the dashboard or via
  `npx convex run <fn> '<json>'` — don't commit a script that nobody will
  use again.
- **No xlsx fixture edits to dodge a validator.** The xlsx is the source
  of truth for fixture content; the seed normaliser bridges the gap to
  the current schema.
