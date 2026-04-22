import { z } from 'zod';
import { cleanCell, jsonCell } from './common/parse';

const stringOpt = z.unknown().transform((v) => cleanCell(v));
const numberOpt = z.unknown().transform((v) => {
  const c = cleanCell(v);
  if (c === undefined) return undefined;
  const n = Number(c);
  return Number.isFinite(n) ? n : undefined;
});
const boolOpt = z.unknown().transform((v) => {
  const c = cleanCell(v);
  if (c === undefined) return undefined;
  if (c === '1' || c.toLowerCase() === 'true') return true;
  if (c === '0' || c.toLowerCase() === 'false') return false;
  return undefined;
});

export const COVERAGE_LEVELS = [
  'none',
  'student',
  'early-resident',
  'advanced-resident',
  'attending',
  'specialist',
] as const;
export type CoverageLevel = (typeof COVERAGE_LEVELS)[number];

const coverageLevelOpt = z.unknown().transform((v) => {
  const c = cleanCell(v);
  if (!c) return undefined;
  return (COVERAGE_LEVELS as readonly string[]).includes(c)
    ? (c as CoverageLevel)
    : undefined;
});

// --- Specialty ---------------------------------------------------------------
export const SpecialtySchema = z.object({
  slug: z.string(),
  name: z.string(),
  source: z.enum(['sheets', 'xlsx']),
  sheetId: z.string().optional(),
  xlsxPath: z.string().optional(),
});
export type Specialty = z.infer<typeof SpecialtySchema>;

// --- Code (Code_Amboss_Mapping) ---------------------------------------------
const ArticleCoverageRefSchema = z
  .object({
    articleTitle: z.string().optional(),
    articleId: z.string().optional(),
    sectionName: z.string().optional(),
  })
  .passthrough();
const ArticleUpdateSchema = z
  .object({
    articleTitle: z.string().optional(),
    articleId: z.string().optional(),
    sectionName: z.string().optional(),
    suggestion: z.string().optional(),
  })
  .passthrough();
const NewArticleRefSchema = z
  .object({
    articleTitle: z.string().optional(),
    justification: z.string().optional(),
  })
  .passthrough();

export const CodeSchema = z
  .object({
    index: stringOpt,
    specialty: stringOpt,
    source: stringOpt,
    code: stringOpt,
    category: stringOpt,
    consolidationCategory: stringOpt,
    description: stringOpt,
    isInAMBOSS: boolOpt,
    articlesWhereCoverageIs: z
      .unknown()
      .transform(jsonCell(z.array(ArticleCoverageRefSchema))),
    notes: stringOpt,
    gaps: stringOpt,
    coverageLevel: coverageLevelOpt,
    depthOfCoverage: numberOpt,
    existingArticleUpdates: z.unknown().transform(jsonCell(z.array(ArticleUpdateSchema))),
    newArticlesNeeded: z.unknown().transform(jsonCell(z.array(NewArticleRefSchema))),
    improvements: stringOpt,
    metadata: z.unknown().transform(jsonCell(z.unknown())),
    fullJsonOutput: z.unknown().transform(jsonCell(z.unknown())),
  })
  .transform((c) => ({ ...c, code: c.code ?? '' }));
export type Code = z.infer<typeof CodeSchema>;

// --- Code_Categories ---------------------------------------------------------
export const CodeCategorySchema = z.object({
  codeCategory: stringOpt,
  source: stringOpt,
  areAllCodesRun: boolOpt,
  isConsolidated: boolOpt,
  description: stringOpt,
  numCodes: numberOpt,
  totalArticleCodes: numberOpt,
  totalSectionCodes: numberOpt,
  codesToIgnore: stringOpt,
  numIncludedCodes: numberOpt,
  includedArticleCodes: z.unknown().transform(jsonCell(z.array(z.string()))),
  numIncludedArticleCodes: numberOpt,
  excludedArticleCodes: z.unknown().transform(jsonCell(z.array(z.string()))),
  numExcludedArticleCodes: numberOpt,
  includedSectionCodes: z.unknown().transform(jsonCell(z.array(z.string()))),
  numIncludedSectionCodes: numberOpt,
  excludedSectionCodes: z.unknown().transform(jsonCell(z.array(z.string()))),
  numExcludedSectionCodes: numberOpt,
  totallyIgnoredCodes: z.unknown().transform(jsonCell(z.array(z.string()))),
  numTotallyIgnoredCodes: numberOpt,
});
export type CodeCategory = z.infer<typeof CodeCategorySchema>;

// --- Consolidated_Articles ---------------------------------------------------
export const ConsolidatedArticleSchema = z.object({
  index: stringOpt,
  articleTitle: stringOpt,
  articleType: stringOpt,
  specialtyName: stringOpt,
  category: stringOpt,
  articleId: stringOpt,
  numCodes: numberOpt,
  codes: z.unknown().transform(jsonCell(z.array(z.record(z.string(), z.unknown())))),
  previousArticleTitleSuggestions: z.unknown().transform(jsonCell(z.array(z.string()))),
  overallCoverage: numberOpt,
  overallImportance: numberOpt,
  justification: stringOpt,
});
export type ConsolidatedArticle = z.infer<typeof ConsolidatedArticleSchema>;

// --- Section_Suggestions (aka Consolidated_Sections) ------------------------
export const ConsolidatedSectionSchema = z.object({
  index: stringOpt,
  assignedEditor: stringOpt,
  editorInTheLoopReview: stringOpt,
  articleTitle: stringOpt,
  articleType: stringOpt,
  articleId: stringOpt,
  sectionName: stringOpt,
  newSection: boolOpt,
  sectionUpdate: boolOpt,
  newPhrase: stringOpt,
  specialtyName: stringOpt,
  category: stringOpt,
  unique_title: stringOpt,
  uniqueId: stringOpt,
  numCodes: numberOpt,
  codes: z.unknown().transform(jsonCell(z.array(z.record(z.string(), z.unknown())))),
  previousSectionNames: z.unknown().transform(jsonCell(z.array(z.string()))),
  exists: boolOpt,
  sectionId: stringOpt,
  overallCoverage: numberOpt,
  overallImportance: numberOpt,
  justification: stringOpt,
  isSearched: boolOpt,
  llmSearchTerms: stringOpt,
  verdict: stringOpt,
  justifcation: stringOpt,
  isSufficientlyCovered: boolOpt,
  areAllSourcesFetched: boolOpt,
});
export type ConsolidatedSection = z.infer<typeof ConsolidatedSectionSchema>;

// --- New_Article_Suggestions -------------------------------------------------
export const NewArticleSuggestionSchema = z.object({
  index: stringOpt,
  assignedEditor: stringOpt,
  editorInTheLoopReview: stringOpt,
  newArticle: boolOpt,
  articleMaintenance: boolOpt,
  articleTitle: stringOpt,
  alternateTitles: stringOpt,
  articleProgress: stringOpt,
  articleType: stringOpt,
  specialtyName: stringOpt,
  articleId: stringOpt,
  codes: z.unknown().transform(jsonCell(z.array(z.record(z.string(), z.unknown())))),
  literatureSearchTerms: stringOpt,
  sections: stringOpt,
  previousArticleTitleSuggestions: z.unknown().transform(jsonCell(z.array(z.string()))),
  previousConsolidationIndexes: z.unknown().transform(jsonCell(z.array(z.number()))),
  existingAmbossCoverage: stringOpt,
  overallImportance: numberOpt,
  justification: stringOpt,
  isSearched: boolOpt,
  llmSearchTerms: stringOpt,
  verdict: stringOpt,
  justifcation: stringOpt,
  isSufficientlyCovered: boolOpt,
  areAllSourcesFetched: boolOpt,
});
export type NewArticleSuggestion = z.infer<typeof NewArticleSuggestionSchema>;

// --- Article_Update_Suggestions (same family as New) -----------------------
export const ArticleUpdateSuggestionSchema = NewArticleSuggestionSchema;
export type ArticleUpdateSuggestion = NewArticleSuggestion;

// --- Source ontologies -------------------------------------------------------
export const IcdCodeSchema = z.object({
  codeCategory: stringOpt,
  codeCategoryDescription: stringOpt,
  icd10Code: stringOpt,
  icd10CodeDescription: stringOpt,
});
export type IcdCode = z.infer<typeof IcdCodeSchema>;

export const AbimCodeSchema = z.object({
  Index: stringOpt,
  primaryCategory: stringOpt,
  secondaryCategory: stringOpt,
  tertiaryCategory: stringOpt,
  disease: stringOpt,
  Specialty: stringOpt,
  code: stringOpt,
  item: stringOpt,
  choice: stringOpt,
  category: stringOpt,
  count: numberOpt,
});
export type AbimCode = z.infer<typeof AbimCodeSchema>;

export const OrphaCodeSchema = z.object({
  orphaCode: stringOpt,
  parentOrphaCode: stringOpt,
  specificName: stringOpt,
  parentCategory: stringOpt,
  orphaTargetFilenamesToInclude: stringOpt,
  icd10lettersToInclude: stringOpt,
  count: numberOpt,
});
export type OrphaCode = z.infer<typeof OrphaCodeSchema>;

// --- Stats (summary) ---------------------------------------------------------
export type StatsSummary = {
  totalCodes?: number;
  completedMappings?: number;
  icdTotalItems?: number;
  icdCompletedRuns?: number;
  coverageScoreBuckets?: Array<{ score: number; count: number; percentage: number }>;
  raw?: Array<Array<string | number | null>>;
};
