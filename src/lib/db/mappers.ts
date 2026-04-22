// Maps between the Zod-parsed repository types and Drizzle row shapes.
// Both directions are explicit so seed + read paths stay symmetric.

import type {
  AbimCode,
  ArticleUpdateSuggestion,
  Code,
  CodeCategory,
  ConsolidatedArticle,
  ConsolidatedSection,
  CoverageLevel,
  IcdCode,
  NewArticleSuggestion,
  OrphaCode,
  StatsSummary,
} from '@/lib/repositories/types';
import { COVERAGE_LEVELS } from '@/lib/repositories/types';
import type {
  abimCodes,
  articleUpdateSuggestions,
  codeCategories,
  codes,
  consolidatedArticles,
  consolidatedSections,
  hcupCodes,
  icd10Codes,
  newArticleSuggestions,
  orphaCodes,
  specialtyStats,
} from './schema';

type Insert<T> = T extends { $inferInsert: infer U } ? U : never;

const n = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

// --- Codes ------------------------------------------------------------------
export function codeToRow(c: Code, specialtySlug: string): Insert<typeof codes> {
  return {
    specialtySlug,
    rowIndex: n(c.index),
    specialty: n(c.specialty),
    source: n(c.source),
    code: c.code,
    category: n(c.category),
    consolidationCategory: n(c.consolidationCategory),
    description: n(c.description),
    isInAmboss: n(c.isInAMBOSS),
    articlesWhereCoverageIs: n(c.articlesWhereCoverageIs),
    notes: n(c.notes),
    gaps: n(c.gaps),
    coverageLevel: n(c.coverageLevel),
    depthOfCoverage: n(c.depthOfCoverage),
    existingArticleUpdates: n(c.existingArticleUpdates),
    newArticlesNeeded: n(c.newArticlesNeeded),
    improvements: n(c.improvements),
    metadata: n(c.metadata),
    fullJsonOutput: n(c.fullJsonOutput),
  };
}

export function rowToCode(r: typeof codes.$inferSelect): Code {
  const coverageLevel =
    r.coverageLevel && (COVERAGE_LEVELS as readonly string[]).includes(r.coverageLevel)
      ? (r.coverageLevel as CoverageLevel)
      : undefined;
  return {
    index: r.rowIndex ?? undefined,
    specialty: r.specialty ?? undefined,
    source: r.source ?? undefined,
    code: r.code,
    category: r.category ?? undefined,
    consolidationCategory: r.consolidationCategory ?? undefined,
    description: r.description ?? undefined,
    isInAMBOSS: r.isInAmboss ?? undefined,
    articlesWhereCoverageIs:
      (r.articlesWhereCoverageIs as Code['articlesWhereCoverageIs']) ?? undefined,
    notes: r.notes ?? undefined,
    gaps: r.gaps ?? undefined,
    coverageLevel,
    depthOfCoverage: r.depthOfCoverage ?? undefined,
    existingArticleUpdates:
      (r.existingArticleUpdates as Code['existingArticleUpdates']) ?? undefined,
    newArticlesNeeded: (r.newArticlesNeeded as Code['newArticlesNeeded']) ?? undefined,
    improvements: r.improvements ?? undefined,
    metadata: r.metadata ?? undefined,
    fullJsonOutput: r.fullJsonOutput ?? undefined,
  };
}

// --- Code categories --------------------------------------------------------
export function codeCategoryToRow(
  c: CodeCategory,
  specialtySlug: string,
): Insert<typeof codeCategories> {
  return {
    specialtySlug,
    codeCategory: n(c.codeCategory),
    source: n(c.source),
    areAllCodesRun: n(c.areAllCodesRun),
    isConsolidated: n(c.isConsolidated),
    description: n(c.description),
    numCodes: n(c.numCodes),
    totalArticleCodes: n(c.totalArticleCodes),
    totalSectionCodes: n(c.totalSectionCodes),
    codesToIgnore: n(c.codesToIgnore),
    numIncludedCodes: n(c.numIncludedCodes),
    includedArticleCodes: n(c.includedArticleCodes),
    numIncludedArticleCodes: n(c.numIncludedArticleCodes),
    excludedArticleCodes: n(c.excludedArticleCodes),
    numExcludedArticleCodes: n(c.numExcludedArticleCodes),
    includedSectionCodes: n(c.includedSectionCodes),
    numIncludedSectionCodes: n(c.numIncludedSectionCodes),
    excludedSectionCodes: n(c.excludedSectionCodes),
    numExcludedSectionCodes: n(c.numExcludedSectionCodes),
    totallyIgnoredCodes: n(c.totallyIgnoredCodes),
    numTotallyIgnoredCodes: n(c.numTotallyIgnoredCodes),
  };
}

export function rowToCodeCategory(r: typeof codeCategories.$inferSelect): CodeCategory {
  return {
    codeCategory: r.codeCategory ?? undefined,
    source: r.source ?? undefined,
    areAllCodesRun: r.areAllCodesRun ?? undefined,
    isConsolidated: r.isConsolidated ?? undefined,
    description: r.description ?? undefined,
    numCodes: r.numCodes ?? undefined,
    totalArticleCodes: r.totalArticleCodes ?? undefined,
    totalSectionCodes: r.totalSectionCodes ?? undefined,
    codesToIgnore: r.codesToIgnore ?? undefined,
    numIncludedCodes: r.numIncludedCodes ?? undefined,
    includedArticleCodes: (r.includedArticleCodes as string[]) ?? undefined,
    numIncludedArticleCodes: r.numIncludedArticleCodes ?? undefined,
    excludedArticleCodes: (r.excludedArticleCodes as string[]) ?? undefined,
    numExcludedArticleCodes: r.numExcludedArticleCodes ?? undefined,
    includedSectionCodes: (r.includedSectionCodes as string[]) ?? undefined,
    numIncludedSectionCodes: r.numIncludedSectionCodes ?? undefined,
    excludedSectionCodes: (r.excludedSectionCodes as string[]) ?? undefined,
    numExcludedSectionCodes: r.numExcludedSectionCodes ?? undefined,
    totallyIgnoredCodes: (r.totallyIgnoredCodes as string[]) ?? undefined,
    numTotallyIgnoredCodes: r.numTotallyIgnoredCodes ?? undefined,
  };
}

// --- Consolidated articles --------------------------------------------------
export function consolidatedArticleToRow(
  a: ConsolidatedArticle,
  specialtySlug: string,
): Insert<typeof consolidatedArticles> {
  return {
    specialtySlug,
    rowIndex: n(a.index),
    articleTitle: n(a.articleTitle),
    articleType: n(a.articleType),
    specialtyName: n(a.specialtyName),
    category: n(a.category),
    articleId: n(a.articleId),
    numCodes: n(a.numCodes),
    codes: n(a.codes),
    previousArticleTitleSuggestions: n(a.previousArticleTitleSuggestions),
    overallCoverage: n(a.overallCoverage),
    overallImportance: n(a.overallImportance),
    justification: n(a.justification),
  };
}

export function rowToConsolidatedArticle(
  r: typeof consolidatedArticles.$inferSelect,
): ConsolidatedArticle {
  return {
    index: r.rowIndex ?? undefined,
    articleTitle: r.articleTitle ?? undefined,
    articleType: r.articleType ?? undefined,
    specialtyName: r.specialtyName ?? undefined,
    category: r.category ?? undefined,
    articleId: r.articleId ?? undefined,
    numCodes: r.numCodes ?? undefined,
    codes: (r.codes as ConsolidatedArticle['codes']) ?? undefined,
    previousArticleTitleSuggestions:
      (r.previousArticleTitleSuggestions as string[]) ?? undefined,
    overallCoverage: r.overallCoverage ?? undefined,
    overallImportance: r.overallImportance ?? undefined,
    justification: r.justification ?? undefined,
  };
}

// --- Consolidated sections --------------------------------------------------
export function consolidatedSectionToRow(
  s: ConsolidatedSection,
  specialtySlug: string,
): Insert<typeof consolidatedSections> {
  return {
    specialtySlug,
    rowIndex: n(s.index),
    assignedEditor: n(s.assignedEditor),
    editorInTheLoopReview: n(s.editorInTheLoopReview),
    articleTitle: n(s.articleTitle),
    articleType: n(s.articleType),
    articleId: n(s.articleId),
    sectionName: n(s.sectionName),
    newSection: n(s.newSection),
    sectionUpdate: n(s.sectionUpdate),
    newPhrase: n(s.newPhrase),
    specialtyName: n(s.specialtyName),
    category: n(s.category),
    uniqueTitle: n(s.unique_title),
    uniqueId: n(s.uniqueId),
    numCodes: n(s.numCodes),
    codes: n(s.codes),
    previousSectionNames: n(s.previousSectionNames),
    exists: n(s.exists),
    sectionId: n(s.sectionId),
    overallCoverage: n(s.overallCoverage),
    overallImportance: n(s.overallImportance),
    justification: n(s.justification),
    isSearched: n(s.isSearched),
    llmSearchTerms: n(s.llmSearchTerms),
    verdict: n(s.verdict),
    justifcation: n(s.justifcation),
    isSufficientlyCovered: n(s.isSufficientlyCovered),
    areAllSourcesFetched: n(s.areAllSourcesFetched),
  };
}

export function rowToConsolidatedSection(
  r: typeof consolidatedSections.$inferSelect,
): ConsolidatedSection {
  return {
    index: r.rowIndex ?? undefined,
    assignedEditor: r.assignedEditor ?? undefined,
    editorInTheLoopReview: r.editorInTheLoopReview ?? undefined,
    articleTitle: r.articleTitle ?? undefined,
    articleType: r.articleType ?? undefined,
    articleId: r.articleId ?? undefined,
    sectionName: r.sectionName ?? undefined,
    newSection: r.newSection ?? undefined,
    sectionUpdate: r.sectionUpdate ?? undefined,
    newPhrase: r.newPhrase ?? undefined,
    specialtyName: r.specialtyName ?? undefined,
    category: r.category ?? undefined,
    unique_title: r.uniqueTitle ?? undefined,
    uniqueId: r.uniqueId ?? undefined,
    numCodes: r.numCodes ?? undefined,
    codes: (r.codes as ConsolidatedSection['codes']) ?? undefined,
    previousSectionNames: (r.previousSectionNames as string[]) ?? undefined,
    exists: r.exists ?? undefined,
    sectionId: r.sectionId ?? undefined,
    overallCoverage: r.overallCoverage ?? undefined,
    overallImportance: r.overallImportance ?? undefined,
    justification: r.justification ?? undefined,
    isSearched: r.isSearched ?? undefined,
    llmSearchTerms: r.llmSearchTerms ?? undefined,
    verdict: r.verdict ?? undefined,
    justifcation: r.justifcation ?? undefined,
    isSufficientlyCovered: r.isSufficientlyCovered ?? undefined,
    areAllSourcesFetched: r.areAllSourcesFetched ?? undefined,
  };
}

// --- Article suggestions (new + update share shape) ------------------------
type ArticleSuggestionTable =
  | typeof newArticleSuggestions
  | typeof articleUpdateSuggestions;

export function articleSuggestionToRow(
  a: NewArticleSuggestion,
  specialtySlug: string,
): Insert<ArticleSuggestionTable> {
  return {
    specialtySlug,
    rowIndex: n(a.index),
    assignedEditor: n(a.assignedEditor),
    editorInTheLoopReview: n(a.editorInTheLoopReview),
    newArticle: n(a.newArticle),
    articleMaintenance: n(a.articleMaintenance),
    articleTitle: n(a.articleTitle),
    alternateTitles: n(a.alternateTitles),
    articleProgress: n(a.articleProgress),
    articleType: n(a.articleType),
    specialtyName: n(a.specialtyName),
    articleId: n(a.articleId),
    codes: n(a.codes),
    literatureSearchTerms: n(a.literatureSearchTerms),
    sections: n(a.sections),
    previousArticleTitleSuggestions: n(a.previousArticleTitleSuggestions),
    previousConsolidationIndexes: n(a.previousConsolidationIndexes),
    existingAmbossCoverage: n(a.existingAmbossCoverage),
    overallImportance: n(a.overallImportance),
    justification: n(a.justification),
    isSearched: n(a.isSearched),
    llmSearchTerms: n(a.llmSearchTerms),
    verdict: n(a.verdict),
    justifcation: n(a.justifcation),
    isSufficientlyCovered: n(a.isSufficientlyCovered),
    areAllSourcesFetched: n(a.areAllSourcesFetched),
  };
}

export function rowToArticleSuggestion(
  r:
    | typeof newArticleSuggestions.$inferSelect
    | typeof articleUpdateSuggestions.$inferSelect,
): NewArticleSuggestion {
  return {
    index: r.rowIndex ?? undefined,
    assignedEditor: r.assignedEditor ?? undefined,
    editorInTheLoopReview: r.editorInTheLoopReview ?? undefined,
    newArticle: r.newArticle ?? undefined,
    articleMaintenance: r.articleMaintenance ?? undefined,
    articleTitle: r.articleTitle ?? undefined,
    alternateTitles: r.alternateTitles ?? undefined,
    articleProgress: r.articleProgress ?? undefined,
    articleType: r.articleType ?? undefined,
    specialtyName: r.specialtyName ?? undefined,
    articleId: r.articleId ?? undefined,
    codes: (r.codes as NewArticleSuggestion['codes']) ?? undefined,
    literatureSearchTerms: r.literatureSearchTerms ?? undefined,
    sections: r.sections ?? undefined,
    previousArticleTitleSuggestions:
      (r.previousArticleTitleSuggestions as string[]) ?? undefined,
    previousConsolidationIndexes:
      (r.previousConsolidationIndexes as number[]) ?? undefined,
    existingAmbossCoverage: r.existingAmbossCoverage ?? undefined,
    overallImportance: r.overallImportance ?? undefined,
    justification: r.justification ?? undefined,
    isSearched: r.isSearched ?? undefined,
    llmSearchTerms: r.llmSearchTerms ?? undefined,
    verdict: r.verdict ?? undefined,
    justifcation: r.justifcation ?? undefined,
    isSufficientlyCovered: r.isSufficientlyCovered ?? undefined,
    areAllSourcesFetched: r.areAllSourcesFetched ?? undefined,
  };
}

export const rowToArticleUpdateSuggestion = rowToArticleSuggestion as (
  r: typeof articleUpdateSuggestions.$inferSelect,
) => ArticleUpdateSuggestion;

// --- Source ontologies ------------------------------------------------------
export function icdToRow(
  c: IcdCode,
  specialtySlug: string,
  table: typeof icd10Codes | typeof hcupCodes,
): Insert<typeof icd10Codes> {
  void table;
  return {
    specialtySlug,
    codeCategory: n(c.codeCategory),
    codeCategoryDescription: n(c.codeCategoryDescription),
    icd10Code: n(c.icd10Code),
    icd10CodeDescription: n(c.icd10CodeDescription),
  };
}

export function rowToIcd(
  r: typeof icd10Codes.$inferSelect | typeof hcupCodes.$inferSelect,
): IcdCode {
  return {
    codeCategory: r.codeCategory ?? undefined,
    codeCategoryDescription: r.codeCategoryDescription ?? undefined,
    icd10Code: r.icd10Code ?? undefined,
    icd10CodeDescription: r.icd10CodeDescription ?? undefined,
  };
}

export function abimToRow(c: AbimCode, specialtySlug: string): Insert<typeof abimCodes> {
  return {
    specialtySlug,
    abimIndex: n(c.Index),
    primaryCategory: n(c.primaryCategory),
    secondaryCategory: n(c.secondaryCategory),
    tertiaryCategory: n(c.tertiaryCategory),
    disease: n(c.disease),
    specialty: n(c.Specialty),
    code: n(c.code),
    item: n(c.item),
    choice: n(c.choice),
    category: n(c.category),
    count: n(c.count),
  };
}

export function rowToAbim(r: typeof abimCodes.$inferSelect): AbimCode {
  return {
    Index: r.abimIndex ?? undefined,
    primaryCategory: r.primaryCategory ?? undefined,
    secondaryCategory: r.secondaryCategory ?? undefined,
    tertiaryCategory: r.tertiaryCategory ?? undefined,
    disease: r.disease ?? undefined,
    Specialty: r.specialty ?? undefined,
    code: r.code ?? undefined,
    item: r.item ?? undefined,
    choice: r.choice ?? undefined,
    category: r.category ?? undefined,
    count: r.count ?? undefined,
  };
}

export function orphaToRow(
  c: OrphaCode,
  specialtySlug: string,
): Insert<typeof orphaCodes> {
  return {
    specialtySlug,
    orphaCode: n(c.orphaCode),
    parentOrphaCode: n(c.parentOrphaCode),
    specificName: n(c.specificName),
    parentCategory: n(c.parentCategory),
    orphaTargetFilenamesToInclude: n(c.orphaTargetFilenamesToInclude),
    icd10LettersToInclude: n(c.icd10lettersToInclude),
    count: n(c.count),
  };
}

export function rowToOrpha(r: typeof orphaCodes.$inferSelect): OrphaCode {
  return {
    orphaCode: r.orphaCode ?? undefined,
    parentOrphaCode: r.parentOrphaCode ?? undefined,
    specificName: r.specificName ?? undefined,
    parentCategory: r.parentCategory ?? undefined,
    orphaTargetFilenamesToInclude: r.orphaTargetFilenamesToInclude ?? undefined,
    icd10lettersToInclude: r.icd10LettersToInclude ?? undefined,
    count: r.count ?? undefined,
  };
}

// --- Stats ------------------------------------------------------------------
export function statsToRow(
  s: StatsSummary,
  specialtySlug: string,
): Insert<typeof specialtyStats> {
  return {
    specialtySlug,
    totalCodes: n(s.totalCodes),
    completedMappings: n(s.completedMappings),
    icdTotalItems: n(s.icdTotalItems),
    icdCompletedRuns: n(s.icdCompletedRuns),
    coverageScoreBuckets: n(s.coverageScoreBuckets),
    raw: n(s.raw),
  };
}

export function rowToStats(r: typeof specialtyStats.$inferSelect): StatsSummary {
  return {
    totalCodes: r.totalCodes ?? undefined,
    completedMappings: r.completedMappings ?? undefined,
    icdTotalItems: r.icdTotalItems ?? undefined,
    icdCompletedRuns: r.icdCompletedRuns ?? undefined,
    coverageScoreBuckets:
      (r.coverageScoreBuckets as StatsSummary['coverageScoreBuckets']) ?? undefined,
    raw: (r.raw as StatsSummary['raw']) ?? undefined,
  };
}
