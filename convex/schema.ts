/**
 * Convex schema aggregator.
 *
 * Per-domain table definitions live in `convex/schema/<domain>.ts`. Adding a
 * new domain: drop a `<domain>Tables` export there, import + spread it here.
 *
 * Single-DB Convex setup. Holds editor-facing data, ontologies, AMBOSS
 * library mirror, pipeline state, auth tables, and rate-limit counters.
 *
 * For shape conventions (jsonBlob vs jsonBlobString, ASCII-only field-name
 * rule) see `convex/schema/_shared.ts`. Phase B2 of the architecture
 * cleanup will normalise the `jsonBlobString` columns to typed
 * arrays-of-records.
 */

import { authTables } from '@convex-dev/auth/server';
import { defineSchema } from 'convex/server';
import { ambossTables } from './schema/amboss';
import { articlesTables } from './schema/articles';
import { codesTables } from './schema/codes';
import { ontologyTables } from './schema/ontology';
import { otpTables } from './schema/otp';
import { pipelineTables } from './schema/pipeline';
import { sectionsTables } from './schema/sections';
import { sourcesTables } from './schema/sources';
import { specialtiesTables } from './schema/specialties';
import { userApiKeysTables } from './schema/userApiKeys';

export default defineSchema({
  ...authTables,
  ...specialtiesTables,
  ...codesTables,
  ...articlesTables,
  ...sectionsTables,
  ...ontologyTables,
  ...ambossTables,
  ...sourcesTables,
  ...pipelineTables,
  ...otpTables,
  ...userApiKeysTables,
});
