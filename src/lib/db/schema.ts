import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Code sources registry — used as the prefix when generating codes (e.g. `ab_…`,
 * `orphanet_…`, `icd10_…`). Seeded with the n8n-era defaults, but users can
 * add more from the pipeline dashboard so the start-run form's source
 * dropdown stays flexible.
 */
export const codeSources = pgTable('code_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Milestone sources registry — separate from `code_sources` because milestone
 * extraction pulls from different upstream publishers (ACGME is the seed).
 */
export const milestoneSources = pgTable('milestone_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Specialties row — mostly an FK target now (pipeline_runs / ontology cascade
 * off it). The editor-facing fields (codes/articles/sections) live in Convex.
 * The `milestones` text column is also gone (Convex `specialties.milestones`
 * is the source of truth).
 */
export const specialties = pgTable('specialties', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  source: text('source').notNull(),
  sheetId: text('sheet_id'),
  xlsxPath: text('xlsx_path'),
  lastSeededAt: timestamp('last_seeded_at', { withTimezone: true }),
  region: text('region'),
  language: text('language'),
});

const specialtyFk = () =>
  text('specialty_slug')
    .notNull()
    .references(() => specialties.slug, { onDelete: 'cascade' });

// --- Source ontologies -------------------------------------------------------

export const icd10Codes = pgTable(
  'icd10_codes',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    codeCategory: text('code_category'),
    codeCategoryDescription: text('code_category_description'),
    icd10Code: text('icd10_code'),
    icd10CodeDescription: text('icd10_code_description'),
  },
  (t) => [index('idx_icd10_codes_specialty').on(t.specialtySlug)],
);

export const hcupCodes = pgTable(
  'hcup_codes',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    codeCategory: text('code_category'),
    codeCategoryDescription: text('code_category_description'),
    icd10Code: text('icd10_code'),
    icd10CodeDescription: text('icd10_code_description'),
  },
  (t) => [index('idx_hcup_codes_specialty').on(t.specialtySlug)],
);

export const abimCodes = pgTable(
  'abim_codes',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    abimIndex: text('abim_index'),
    primaryCategory: text('primary_category'),
    secondaryCategory: text('secondary_category'),
    tertiaryCategory: text('tertiary_category'),
    disease: text('disease'),
    specialty: text('specialty'),
    code: text('code'),
    item: text('item'),
    choice: text('choice'),
    category: text('category'),
    count: integer('count'),
  },
  (t) => [index('idx_abim_codes_specialty').on(t.specialtySlug)],
);

export const orphaCodes = pgTable(
  'orpha_codes',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    orphaCode: text('orpha_code'),
    parentOrphaCode: text('parent_orpha_code'),
    specificName: text('specific_name'),
    parentCategory: text('parent_category'),
    orphaTargetFilenamesToInclude: text('orpha_target_filenames_to_include'),
    icd10LettersToInclude: text('icd10_letters_to_include'),
    count: integer('count'),
  },
  (t) => [index('idx_orpha_codes_specialty').on(t.specialtySlug)],
);

// --- Pipeline runs (Vercel Workflow DevKit) ---------------------------------

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    specialtySlug: specialtyFk(),
    status: text('status').notNull().default('running'),
    workflowRunId: text('workflow_run_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    contentOutlineUrls: jsonb('content_outline_urls'),
    identifyModulesInstructions: text('identify_modules_instructions'),
    extractCodesInstructions: text('extract_codes_instructions'),
    milestonesInstructions: text('milestones_instructions'),
    mappingInstructions: text('mapping_instructions'),
    mappingCheckIds: boolean('mapping_check_ids').notNull().default(true),
    mappingFilter: jsonb('mapping_filter'),
  },
  (t) => [index('idx_pipeline_runs_specialty').on(t.specialtySlug)],
);

export const pipelineStages = pgTable(
  'pipeline_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull(),
    status: text('status').notNull().default('pending'),
    workflowRunId: text('workflow_run_id'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    outputSummary: jsonb('output_summary'),
    draftPayload: jsonb('draft_payload'),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('idx_pipeline_stages_run').on(t.runId),
    index('idx_pipeline_stages_run_stage').on(t.runId, t.stage),
  ],
);

export const pipelineEvents = pgTable(
  'pipeline_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull(),
    level: text('level').notNull().default('info'),
    message: text('message').notNull(),
    metrics: jsonb('metrics'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_pipeline_events_run').on(t.runId),
    index('idx_pipeline_events_run_stage').on(t.runId, t.stage, t.createdAt),
  ],
);

export const extractedCodes = pgTable(
  'extracted_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    specialtySlug: specialtyFk(),
    code: text('code').notNull(),
    category: text('category'),
    consolidationCategory: text('consolidation_category'),
    description: text('description'),
    source: text('source'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_extracted_codes_run').on(t.runId),
    index('idx_extracted_codes_specialty').on(t.specialtySlug),
  ],
);

// --- AMBOSS article / section catalog ----------------------------------------
//
// Local mirror of the AMBOSS content library's canonical article + section IDs
// so the mapping workflow can validate the IDs the LLM cites without
// round-tripping the MCP server for every code. Refreshed from an external
// JSON export (see `scripts/refresh-amboss-library.ts`); typically ~1.5k
// articles + ~15k sections.
export const ambossArticles = pgTable('amboss_articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  contentBase: text('content_base'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ambossSections = pgTable(
  'amboss_sections',
  {
    id: text('id').primaryKey(),
    articleId: text('article_id')
      .notNull()
      .references(() => ambossArticles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_amboss_sections_article').on(t.articleId)],
);
