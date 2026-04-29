import { parseRows } from '../common/parse';
import { TAB } from '../common/tab-names';
import type { SourceOntologyRepo, SpecialtyRepo } from '../interfaces';
import {
  AbimCodeSchema,
  ArticleUpdateSuggestionSchema,
  CodeCategorySchema,
  CodeSchema,
  ConsolidatedArticleSchema,
  ConsolidatedSectionSchema,
  IcdCodeSchema,
  NewArticleSuggestionSchema,
  OrphaCodeSchema,
  type Specialty,
  type StatsSummary,
} from '../types';
import { readTabRows } from './client';

interface Registry {
  slug: string;
  name: string;
  sheetId: string;
}

function sheetIdFor(registry: Registry[], slug: string): string | null {
  return registry.find((r) => r.slug === slug)?.sheetId ?? null;
}

export function createSheetsRepos(registry: Registry[]) {
  const specialties: SpecialtyRepo = {
    async list() {
      return registry.map<Specialty>((r) => ({
        slug: r.slug,
        name: r.name,
        source: 'sheets',
        sheetId: r.sheetId,
      }));
    },
    async get(slug) {
      const r = registry.find((x) => x.slug === slug);
      return r
        ? { slug: r.slug, name: r.name, source: 'sheets', sheetId: r.sheetId }
        : null;
    },
  };

  const codes = {
    async list(slug: string) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.CodeAmbossMapping);
      return parseRows(rows, CodeSchema, { tabName: TAB.CodeAmbossMapping }).items;
    },
  };

  const categories = {
    async list(slug: string) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.CodeCategories);
      return parseRows(rows, CodeCategorySchema, { tabName: TAB.CodeCategories }).items;
    },
  };

  const articles = {
    async listConsolidated(slug: string) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.ConsolidatedArticles);
      return parseRows(rows, ConsolidatedArticleSchema, {
        tabName: TAB.ConsolidatedArticles,
      }).items;
    },
    async listNew(slug: string) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.NewArticleSuggestions);
      return parseRows(rows, NewArticleSuggestionSchema, {
        tabName: TAB.NewArticleSuggestions,
      }).items;
    },
    async listUpdates(slug: string) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.ArticleUpdateSuggestions);
      return parseRows(rows, ArticleUpdateSuggestionSchema, {
        tabName: TAB.ArticleUpdateSuggestions,
      }).items;
    },
  };

  const sections = {
    async listConsolidated(slug: string) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.ConsolidatedSections);
      return parseRows(rows, ConsolidatedSectionSchema, {
        tabName: TAB.ConsolidatedSections,
      }).items;
    },
  };

  const sources: SourceOntologyRepo = {
    async icd10(slug) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.SpecialtyIcd10Codes);
      return parseRows(rows, IcdCodeSchema, { tabName: TAB.SpecialtyIcd10Codes }).items;
    },
    async hcup(slug) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.SpecialtyIcd10CodesHcup);
      return parseRows(rows, IcdCodeSchema, { tabName: TAB.SpecialtyIcd10CodesHcup })
        .items;
    },
    async abim(slug) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.SpecialtyAbimExpandedContent);
      return parseRows(rows, AbimCodeSchema, {
        tabName: TAB.SpecialtyAbimExpandedContent,
      }).items;
    },
    async orpha(slug) {
      const id = sheetIdFor(registry, slug);
      if (!id) return [];
      const rows = await readTabRows(id, TAB.SpecialtyOrphaCodes);
      return parseRows(rows, OrphaCodeSchema, { tabName: TAB.SpecialtyOrphaCodes }).items;
    },
  };

  const stats = {
    async get(slug: string) {
      const id = sheetIdFor(registry, slug);
      if (!id) return {};
      const rows = await readTabRows(id, TAB.Stats);
      const summary: StatsSummary = { raw: rows.slice(0, 30) as StatsSummary['raw'] };
      for (const row of rows) {
        const label = String(row[0] ?? '').trim();
        if (label === 'Total') summary.totalCodes = Number(row[1]) || undefined;
        if (label === 'Completed mappings')
          summary.completedMappings = Number(row[1]) || undefined;
      }
      return summary;
    },
  };

  return { specialties, codes, categories, articles, sections, sources, stats };
}
