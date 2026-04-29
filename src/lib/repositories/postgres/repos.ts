import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { rowToAbim, rowToIcd, rowToOrpha } from '@/lib/db/mappers';
import {
  abimCodes,
  hcupCodes,
  icd10Codes,
  orphaCodes,
  specialties as specialtiesTable,
} from '@/lib/db/schema';
import type { Repositories, SourceOntologyRepo, SpecialtyRepo } from '../interfaces';
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

  return { specialties, sources };
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
