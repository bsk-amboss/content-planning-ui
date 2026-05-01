import type { OntologySource } from './common/tab-names';
import type { AbimCode, IcdCode, OrphaCode, Specialty } from './types';

export interface SpecialtyRepo {
  list(): Promise<Specialty[]>;
  get(slug: string): Promise<Specialty | null>;
}
export interface SourceOntologyRepo {
  icd10(slug: string): Promise<IcdCode[]>;
  hcup(slug: string): Promise<IcdCode[]>;
  abim(slug: string): Promise<AbimCode[]>;
  orpha(slug: string): Promise<OrphaCode[]>;
}

/**
 * The post-migration repository surface. The codes/articles/sections/categories
 * + stats methods used to live here too — those readers all moved to Convex
 * (see `src/lib/data/codes.ts` etc. and `convex/*.ts`). Only the ontology
 * sources remain Postgres-served for now (Phase 2 of the migration moves them
 * to Convex too, at which point this whole abstraction goes away).
 */
export interface Repositories {
  specialties: SpecialtyRepo;
  sources: SourceOntologyRepo;
}

export type { OntologySource };
