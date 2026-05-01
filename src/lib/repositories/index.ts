import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from '@/env';
import type { Specialty } from './types';

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

export function buildXlsxRegistry(): XlsxRegistryEntry[] {
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

/**
 * Combined specialty registry. Sheets entries take precedence over xlsx ones
 * with the same slug. Used by the debug route to resolve a slug → upstream
 * source for tab-schema inspection.
 */
export function getSpecialtyRegistry(): Specialty[] {
  const bySlug = new Map<string, Specialty>();
  for (const x of buildXlsxRegistry()) {
    bySlug.set(x.slug, {
      slug: x.slug,
      name: x.name,
      source: 'xlsx',
      xlsxPath: x.xlsxPath,
    });
  }
  for (const s of buildSheetsRegistry()) {
    bySlug.set(s.slug, {
      slug: s.slug,
      name: s.name,
      source: 'sheets',
      sheetId: s.sheetId,
    });
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}
