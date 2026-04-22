import type { OntologySource } from './common/tab-names';
import type {
  AbimCode,
  ArticleUpdateSuggestion,
  Code,
  CodeCategory,
  ConsolidatedArticle,
  ConsolidatedSection,
  IcdCode,
  NewArticleSuggestion,
  OrphaCode,
  Specialty,
  StatsSummary,
} from './types';

export interface SpecialtyRepo {
  list(): Promise<Specialty[]>;
  get(slug: string): Promise<Specialty | null>;
}
export interface CodeRepo {
  list(slug: string): Promise<Code[]>;
}
export interface CodeCategoryRepo {
  list(slug: string): Promise<CodeCategory[]>;
}
export interface ArticleRepo {
  listConsolidated(slug: string): Promise<ConsolidatedArticle[]>;
  listNew(slug: string): Promise<NewArticleSuggestion[]>;
  listUpdates(slug: string): Promise<ArticleUpdateSuggestion[]>;
}
export interface SectionRepo {
  listConsolidated(slug: string): Promise<ConsolidatedSection[]>;
}
export interface SourceOntologyRepo {
  icd10(slug: string): Promise<IcdCode[]>;
  hcup(slug: string): Promise<IcdCode[]>;
  abim(slug: string): Promise<AbimCode[]>;
  orpha(slug: string): Promise<OrphaCode[]>;
}
export interface StatsRepo {
  get(slug: string): Promise<StatsSummary>;
}

export interface Repositories {
  specialties: SpecialtyRepo;
  codes: CodeRepo;
  categories: CodeCategoryRepo;
  articles: ArticleRepo;
  sections: SectionRepo;
  sources: SourceOntologyRepo;
  stats: StatsRepo;
}

export type { OntologySource };
