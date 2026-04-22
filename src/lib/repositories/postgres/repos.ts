import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  rowToAbim,
  rowToArticleSuggestion,
  rowToArticleUpdateSuggestion,
  rowToCode,
  rowToCodeCategory,
  rowToConsolidatedArticle,
  rowToConsolidatedSection,
  rowToIcd,
  rowToOrpha,
  rowToStats,
} from '@/lib/db/mappers';
import {
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
  specialties as specialtiesTable,
  specialtyStats,
} from '@/lib/db/schema';
import type {
  ArticleRepo,
  CodeCategoryRepo,
  CodeRepo,
  Repositories,
  SectionRepo,
  SourceOntologyRepo,
  SpecialtyRepo,
  StatsRepo,
} from '../interfaces';
import type { Specialty } from '../types';

function toSpecialty(r: typeof specialtiesTable.$inferSelect): Specialty {
  const source = r.source === 'sheets' ? 'sheets' : 'xlsx';
  return {
    slug: r.slug,
    name: r.name,
    source,
    sheetId: r.sheetId ?? undefined,
    xlsxPath: r.xlsxPath ?? undefined,
  };
}

export function createPostgresRepos(): Repositories {
  const specialties: SpecialtyRepo = {
    async list() {
      const db = getDb();
      const rows = await db.select().from(specialtiesTable);
      return rows.map(toSpecialty).sort((a, b) => a.name.localeCompare(b.name));
    },
    async get(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(specialtiesTable)
        .where(eq(specialtiesTable.slug, slug))
        .limit(1);
      return rows[0] ? toSpecialty(rows[0]) : null;
    },
  };

  const codeRepo: CodeRepo = {
    async list(slug) {
      const db = getDb();
      const rows = await db.select().from(codes).where(eq(codes.specialtySlug, slug));
      return rows.map(rowToCode);
    },
  };

  const categories: CodeCategoryRepo = {
    async list(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(codeCategories)
        .where(eq(codeCategories.specialtySlug, slug));
      return rows.map(rowToCodeCategory);
    },
  };

  const articles: ArticleRepo = {
    async listConsolidated(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(consolidatedArticles)
        .where(eq(consolidatedArticles.specialtySlug, slug));
      return rows.map(rowToConsolidatedArticle);
    },
    async listNew(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(newArticleSuggestions)
        .where(eq(newArticleSuggestions.specialtySlug, slug));
      return rows.map(rowToArticleSuggestion);
    },
    async listUpdates(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(articleUpdateSuggestions)
        .where(eq(articleUpdateSuggestions.specialtySlug, slug));
      return rows.map(rowToArticleUpdateSuggestion);
    },
  };

  const sections: SectionRepo = {
    async listConsolidated(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(consolidatedSections)
        .where(eq(consolidatedSections.specialtySlug, slug));
      return rows.map(rowToConsolidatedSection);
    },
  };

  const sources: SourceOntologyRepo = {
    async icd10(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(icd10Codes)
        .where(eq(icd10Codes.specialtySlug, slug));
      return rows.map(rowToIcd);
    },
    async hcup(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(hcupCodes)
        .where(eq(hcupCodes.specialtySlug, slug));
      return rows.map(rowToIcd);
    },
    async abim(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(abimCodes)
        .where(eq(abimCodes.specialtySlug, slug));
      return rows.map(rowToAbim);
    },
    async orpha(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(orphaCodes)
        .where(eq(orphaCodes.specialtySlug, slug));
      return rows.map(rowToOrpha);
    },
  };

  const stats: StatsRepo = {
    async get(slug) {
      const db = getDb();
      const rows = await db
        .select()
        .from(specialtyStats)
        .where(eq(specialtyStats.specialtySlug, slug))
        .limit(1);
      return rows[0] ? rowToStats(rows[0]) : {};
    },
  };

  return { specialties, codes: codeRepo, categories, articles, sections, sources, stats };
}

/**
 * Checks whether Postgres has any rows for the given specialty. Used by the
 * backend switch so the app falls back to xlsx/sheets when the DB is empty.
 */
export async function hasSeededSpecialty(slug: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ slug: specialtiesTable.slug })
    .from(specialtiesTable)
    .where(eq(specialtiesTable.slug, slug))
    .limit(1);
  return rows.length > 0;
}

export async function listSeededSpecialties(): Promise<Specialty[]> {
  const db = getDb();
  const rows = await db.select().from(specialtiesTable);
  return rows.map(toSpecialty).sort((a, b) => a.name.localeCompare(b.name));
}
