import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const specialties = pgTable('specialties', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  source: text('source').notNull(),
  sheetId: text('sheet_id'),
  xlsxPath: text('xlsx_path'),
  lastSeededAt: timestamp('last_seeded_at', { withTimezone: true }),
  // Approved milestone set for this specialty. Populated by the preprocessing
  // pipeline once the user signs off. Draft versions live on pipeline_stages.
  milestones: jsonb('milestones'),
  // Region/language optional; only identity columns live on the specialty.
  // Per-run inputs (PDF URLs, system prompts) live on pipeline_runs.
  region: text('region'),
  language: text('language'),
});

const specialtyFk = () =>
  text('specialty_slug')
    .notNull()
    .references(() => specialties.slug, { onDelete: 'cascade' });

export const codes = pgTable(
  'codes',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    rowIndex: text('row_index'),
    specialty: text('specialty'),
    source: text('source'),
    code: text('code').notNull(),
    category: text('category'),
    consolidationCategory: text('consolidation_category'),
    description: text('description'),
    isInAmboss: boolean('is_in_amboss'),
    articlesWhereCoverageIs: jsonb('articles_where_coverage_is'),
    notes: text('notes'),
    gaps: text('gaps'),
    coverageLevel: text('coverage_level'),
    depthOfCoverage: integer('depth_of_coverage'),
    existingArticleUpdates: jsonb('existing_article_updates'),
    newArticlesNeeded: jsonb('new_articles_needed'),
    improvements: text('improvements'),
    metadata: jsonb('metadata'),
    fullJsonOutput: jsonb('full_json_output'),
  },
  (t) => [
    index('idx_codes_specialty').on(t.specialtySlug),
    index('idx_codes_specialty_code').on(t.specialtySlug, t.code),
    index('idx_codes_specialty_category').on(t.specialtySlug, t.category),
    index('idx_codes_specialty_consolidation').on(
      t.specialtySlug,
      t.consolidationCategory,
    ),
  ],
);

export const codeCategories = pgTable(
  'code_categories',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    codeCategory: text('code_category'),
    source: text('source'),
    areAllCodesRun: boolean('are_all_codes_run'),
    isConsolidated: boolean('is_consolidated'),
    description: text('description'),
    numCodes: integer('num_codes'),
    totalArticleCodes: integer('total_article_codes'),
    totalSectionCodes: integer('total_section_codes'),
    codesToIgnore: text('codes_to_ignore'),
    numIncludedCodes: integer('num_included_codes'),
    includedArticleCodes: jsonb('included_article_codes'),
    numIncludedArticleCodes: integer('num_included_article_codes'),
    excludedArticleCodes: jsonb('excluded_article_codes'),
    numExcludedArticleCodes: integer('num_excluded_article_codes'),
    includedSectionCodes: jsonb('included_section_codes'),
    numIncludedSectionCodes: integer('num_included_section_codes'),
    excludedSectionCodes: jsonb('excluded_section_codes'),
    numExcludedSectionCodes: integer('num_excluded_section_codes'),
    totallyIgnoredCodes: jsonb('totally_ignored_codes'),
    numTotallyIgnoredCodes: integer('num_totally_ignored_codes'),
  },
  (t) => [index('idx_code_categories_specialty').on(t.specialtySlug)],
);

export const consolidatedArticles = pgTable(
  'consolidated_articles',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    rowIndex: text('row_index'),
    articleTitle: text('article_title'),
    articleType: text('article_type'),
    specialtyName: text('specialty_name'),
    category: text('category'),
    articleId: text('article_id'),
    numCodes: integer('num_codes'),
    codes: jsonb('codes'),
    previousArticleTitleSuggestions: jsonb('previous_article_title_suggestions'),
    overallCoverage: real('overall_coverage'),
    overallImportance: real('overall_importance'),
    justification: text('justification'),
  },
  (t) => [index('idx_consolidated_articles_specialty').on(t.specialtySlug)],
);

export const consolidatedSections = pgTable(
  'consolidated_sections',
  {
    id: serial('id').primaryKey(),
    specialtySlug: specialtyFk(),
    rowIndex: text('row_index'),
    assignedEditor: text('assigned_editor'),
    editorInTheLoopReview: text('editor_in_the_loop_review'),
    articleTitle: text('article_title'),
    articleType: text('article_type'),
    articleId: text('article_id'),
    sectionName: text('section_name'),
    newSection: boolean('new_section'),
    sectionUpdate: boolean('section_update'),
    newPhrase: text('new_phrase'),
    specialtyName: text('specialty_name'),
    category: text('category'),
    uniqueTitle: text('unique_title'),
    uniqueId: text('unique_id'),
    numCodes: integer('num_codes'),
    codes: jsonb('codes'),
    previousSectionNames: jsonb('previous_section_names'),
    exists: boolean('does_exist'),
    sectionId: text('section_id'),
    overallCoverage: real('overall_coverage'),
    overallImportance: real('overall_importance'),
    justification: text('justification'),
    isSearched: boolean('is_searched'),
    llmSearchTerms: text('llm_search_terms'),
    verdict: text('verdict'),
    justifcation: text('justifcation'),
    isSufficientlyCovered: boolean('is_sufficiently_covered'),
    areAllSourcesFetched: boolean('are_all_sources_fetched'),
  },
  (t) => [index('idx_consolidated_sections_specialty').on(t.specialtySlug)],
);

// Shared shape for new + update suggestions — same columns, different tables so
// the workflow can enqueue them independently.
const articleSuggestionColumns = {
  id: serial('id').primaryKey(),
  rowIndex: text('row_index'),
  assignedEditor: text('assigned_editor'),
  editorInTheLoopReview: text('editor_in_the_loop_review'),
  newArticle: boolean('new_article'),
  articleMaintenance: boolean('article_maintenance'),
  articleTitle: text('article_title'),
  alternateTitles: text('alternate_titles'),
  articleProgress: text('article_progress'),
  articleType: text('article_type'),
  specialtyName: text('specialty_name'),
  articleId: text('article_id'),
  codes: jsonb('codes'),
  literatureSearchTerms: text('literature_search_terms'),
  sections: text('sections'),
  previousArticleTitleSuggestions: jsonb('previous_article_title_suggestions'),
  previousConsolidationIndexes: jsonb('previous_consolidation_indexes'),
  existingAmbossCoverage: text('existing_amboss_coverage'),
  overallImportance: real('overall_importance'),
  justification: text('justification'),
  isSearched: boolean('is_searched'),
  llmSearchTerms: text('llm_search_terms'),
  verdict: text('verdict'),
  justifcation: text('justifcation'),
  isSufficientlyCovered: boolean('is_sufficiently_covered'),
  areAllSourcesFetched: boolean('are_all_sources_fetched'),
};

export const newArticleSuggestions = pgTable(
  'new_article_suggestions',
  {
    ...articleSuggestionColumns,
    specialtySlug: specialtyFk(),
  },
  (t) => [index('idx_new_article_suggestions_specialty').on(t.specialtySlug)],
);

export const articleUpdateSuggestions = pgTable(
  'article_update_suggestions',
  {
    ...articleSuggestionColumns,
    specialtySlug: specialtyFk(),
  },
  (t) => [index('idx_article_update_suggestions_specialty').on(t.specialtySlug)],
);

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
    // 'running' | 'awaiting_preprocessing_approval' | 'mapping' |
    // 'consolidating' | 'completed' | 'failed' | 'cancelled'
    status: text('status').notNull().default('running'),
    workflowRunId: text('workflow_run_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    // Per-run inputs — captured when the user triggers a run. A single
    // specialty can be re-extracted from a different set of PDFs without
    // mutating its registry row.
    contentOutlineUrls: jsonb('content_outline_urls'),
    extractionSystemPrompt: text('extraction_system_prompt'),
    milestonesSystemPrompt: text('milestones_system_prompt'),
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
    // 'extract_codes' | 'extract_milestones' | 'map_codes' |
    // 'consolidate_primary' | 'consolidate_articles' | 'consolidate_sections'
    stage: text('stage').notNull(),
    // 'pending' | 'running' | 'awaiting_approval' | 'approved' |
    // 'completed' | 'failed' | 'skipped'
    status: text('status').notNull().default('pending'),
    workflowRunId: text('workflow_run_id'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    outputSummary: jsonb('output_summary'),
    // Draft payload held here for small artifacts (e.g. milestone list) before
    // approval. Large staging data lives in dedicated tables like
    // extracted_codes.
    draftPayload: jsonb('draft_payload'),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('idx_pipeline_stages_run').on(t.runId),
    index('idx_pipeline_stages_run_stage').on(t.runId, t.stage),
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

// --- Stats (summary rollup) --------------------------------------------------
// Stats are derived; we store the parsed snapshot so /planning/[specialty]
// doesn't have to re-read the upstream Stats sheet each request.
export const specialtyStats = pgTable('specialty_stats', {
  specialtySlug: text('specialty_slug')
    .primaryKey()
    .references(() => specialties.slug, { onDelete: 'cascade' }),
  totalCodes: integer('total_codes'),
  completedMappings: integer('completed_mappings'),
  icdTotalItems: integer('icd_total_items'),
  icdCompletedRuns: integer('icd_completed_runs'),
  coverageScoreBuckets: jsonb('coverage_score_buckets'),
  raw: jsonb('raw'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
