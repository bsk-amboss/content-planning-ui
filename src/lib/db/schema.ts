import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Specialties row — FK target for pipeline_runs / extracted_codes. The
 * editor-facing fields (codes/articles/sections, plus milestones/region/
 * language) live in Convex. Phase 3 of the migration drops this entirely.
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
