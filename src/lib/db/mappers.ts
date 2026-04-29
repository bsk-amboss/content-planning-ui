// Maps between the Zod-parsed repository types and Drizzle row shapes for
// ontology tables only. The editor-table mappers (codes/articles/sections/
// categories/stats) lived here too — those tables moved to Convex, so the
// mappers went with them. Phase 2 of the migration moves ontology to Convex
// too, at which point this file goes away.

import type { AbimCode, IcdCode, OrphaCode } from '@/lib/repositories/types';
import type { abimCodes, hcupCodes, icd10Codes, orphaCodes } from './schema';

type Insert<T> = T extends { $inferInsert: infer U } ? U : never;

const n = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

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
