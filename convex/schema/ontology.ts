import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// Read-only ontology mirrors. Replace + read pattern (refreshed via xlsx
// seed); UI consumes via fetchQuery in src/lib/data/sources.ts.

export const ontologyTables = {
  icd10Codes: defineTable({
    specialtySlug: v.string(),
    codeCategory: v.optional(v.string()),
    codeCategoryDescription: v.optional(v.string()),
    icd10Code: v.optional(v.string()),
    icd10CodeDescription: v.optional(v.string()),
  }).index('by_specialty', ['specialtySlug']),

  hcupCodes: defineTable({
    specialtySlug: v.string(),
    codeCategory: v.optional(v.string()),
    codeCategoryDescription: v.optional(v.string()),
    icd10Code: v.optional(v.string()),
    icd10CodeDescription: v.optional(v.string()),
  }).index('by_specialty', ['specialtySlug']),

  abimCodes: defineTable({
    specialtySlug: v.string(),
    abimIndex: v.optional(v.string()),
    primaryCategory: v.optional(v.string()),
    secondaryCategory: v.optional(v.string()),
    tertiaryCategory: v.optional(v.string()),
    disease: v.optional(v.string()),
    specialty: v.optional(v.string()),
    code: v.optional(v.string()),
    item: v.optional(v.string()),
    choice: v.optional(v.string()),
    category: v.optional(v.string()),
    count: v.optional(v.number()),
  }).index('by_specialty', ['specialtySlug']),

  orphaCodes: defineTable({
    specialtySlug: v.string(),
    orphaCode: v.optional(v.string()),
    parentOrphaCode: v.optional(v.string()),
    specificName: v.optional(v.string()),
    parentCategory: v.optional(v.string()),
    orphaTargetFilenamesToInclude: v.optional(v.string()),
    icd10LettersToInclude: v.optional(v.string()),
    count: v.optional(v.number()),
  }).index('by_specialty', ['specialtySlug']),
};
