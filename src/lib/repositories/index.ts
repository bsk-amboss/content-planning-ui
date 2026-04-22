import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from '@/env';
import { hasDatabaseUrl } from '@/lib/db';
import type { Repositories } from './interfaces';
import { createPostgresRepos } from './postgres/repos';
import { createSheetsRepos } from './sheets/repos';
import type { Specialty } from './types';
import { createXlsxRepos } from './xlsx/repos';

interface SheetsRegistryEntry {
  slug: string;
  name: string;
  sheetId: string;
}
interface XlsxRegistryEntry {
  slug: string;
  name: string;
  xlsxPath: string;
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/g)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function buildSheetsRegistry(): SheetsRegistryEntry[] {
  if (!env.GOOGLE_SA_CLIENT_EMAIL || !env.GOOGLE_SA_PRIVATE_KEY) return [];
  return Object.entries(env.MAPPING_SHEET_IDS).map(([slug, sheetId]) => ({
    slug,
    name: titleCase(slug),
    sheetId,
  }));
}

function buildXlsxRegistry(): XlsxRegistryEntry[] {
  const explicit = Object.entries(env.LOCAL_XLSX_FIXTURES ?? {}).map(
    ([slug, xlsxPath]) => ({
      slug,
      name: titleCase(slug),
      xlsxPath,
    }),
  );
  const defaultFixturePath = path.join(process.cwd(), 'anesthesiology_mapping.xlsx');
  const hasDefault = existsSync(defaultFixturePath);
  const hasExplicitAnesthesiology = explicit.some((e) => e.slug === 'anesthesiology');
  if (hasDefault && !hasExplicitAnesthesiology) {
    explicit.push({
      slug: 'anesthesiology',
      name: 'Anesthesiology',
      xlsxPath: defaultFixturePath,
    });
  }
  return explicit;
}

function combineSpecialties(
  sheets: SheetsRegistryEntry[],
  xlsx: XlsxRegistryEntry[],
): Specialty[] {
  const bySlug = new Map<string, Specialty>();
  for (const x of xlsx) {
    bySlug.set(x.slug, {
      slug: x.slug,
      name: x.name,
      source: 'xlsx',
      xlsxPath: x.xlsxPath,
    });
  }
  for (const s of sheets) {
    // Sheets takes precedence when both are registered.
    bySlug.set(s.slug, {
      slug: s.slug,
      name: s.name,
      source: 'sheets',
      sheetId: s.sheetId,
    });
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}

let cached: { repos: Repositories; specialties: Specialty[]; mode: Mode } | null = null;

type Mode = 'postgres' | 'legacy';

export function getRepositories(): {
  repos: Repositories;
  specialties: Specialty[];
  mode: Mode;
} {
  if (cached) return cached;

  const sheetsRegistry = buildSheetsRegistry();
  const xlsxRegistry = buildXlsxRegistry();
  const registrySpecialties = combineSpecialties(sheetsRegistry, xlsxRegistry);

  const mode: Mode = hasDatabaseUrl() ? 'postgres' : 'legacy';

  let repos: Repositories;
  if (mode === 'postgres') {
    // Postgres is the sole backend when DATABASE_URL is set. Seeding is required
    // before data appears; empty lists surface as empty tables in the UI.
    repos = createPostgresRepos();
  } else {
    const sheetsRepos = createSheetsRepos(sheetsRegistry);
    const xlsxRepos = createXlsxRepos(xlsxRegistry);
    const pick = <K extends keyof Repositories>(key: K, slug: string) => {
      const sheetsHas = sheetsRegistry.some((s) => s.slug === slug);
      return sheetsHas ? sheetsRepos[key] : xlsxRepos[key];
    };
    repos = {
      specialties: {
        async list() {
          return registrySpecialties;
        },
        async get(slug) {
          return registrySpecialties.find((s) => s.slug === slug) ?? null;
        },
      },
      codes: { list: (slug) => pick('codes', slug).list(slug) },
      categories: { list: (slug) => pick('categories', slug).list(slug) },
      articles: {
        listConsolidated: (slug) => pick('articles', slug).listConsolidated(slug),
        listNew: (slug) => pick('articles', slug).listNew(slug),
        listUpdates: (slug) => pick('articles', slug).listUpdates(slug),
      },
      sections: {
        listConsolidated: (slug) => pick('sections', slug).listConsolidated(slug),
      },
      sources: {
        icd10: (slug) => pick('sources', slug).icd10(slug),
        hcup: (slug) => pick('sources', slug).hcup(slug),
        abim: (slug) => pick('sources', slug).abim(slug),
        orpha: (slug) => pick('sources', slug).orpha(slug),
      },
      stats: { get: (slug) => pick('stats', slug).get(slug) },
    };
  }

  cached = { repos, specialties: registrySpecialties, mode };
  return cached;
}
