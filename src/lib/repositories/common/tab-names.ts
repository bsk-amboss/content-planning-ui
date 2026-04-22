export const TAB = {
  Stats: 'Stats',
  CodeAmbossMapping: 'Code_Amboss_Mapping',
  CodeCategories: 'Code_Categories',
  ConsolidatedArticles: 'Consolidated_Articles',
  ConsolidatedSections: 'Section_Suggestions',
  ArticleUpdateSuggestions: 'Article_Update_Suggestions',
  NewArticleSuggestions: 'New_Article_Suggestions',
  SpecialtyIcd10Codes: 'Specialty_ICD10_Codes',
  SpecialtyIcd10CodesHcup: 'Specialty_ICD10_Codes_HCUP',
  SpecialtyAbimExpandedContent: 'Specialty_ABIM_Expanded_Content',
  SpecialtyOrphaCodes: 'Specialty_OrphaCodes',
  AllOrphaCodes: 'All_OrphaCodes',
} as const;

export type TabName = (typeof TAB)[keyof typeof TAB];

export const ONTOLOGY_SOURCES = ['ICD10', 'HCUP', 'ABIM', 'Orpha'] as const;
export type OntologySource = (typeof ONTOLOGY_SOURCES)[number];
