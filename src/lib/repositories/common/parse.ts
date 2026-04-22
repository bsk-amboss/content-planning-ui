import type { z } from 'zod';

const NULLISH_STRINGS = new Set(['', '#N/A', '#REF!', '#NAME?', '#VALUE!', '#DIV/0!']);

export function cleanCell(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).trim();
  if (NULLISH_STRINGS.has(s)) return undefined;
  return s;
}

export function jsonCell<T>(schema: z.ZodType<T>) {
  return (raw: unknown, ctx: z.RefinementCtx): T | undefined => {
    const cleaned = cleanCell(raw);
    if (cleaned === undefined) return undefined;
    try {
      const parsed = JSON.parse(cleaned);
      const result = schema.safeParse(parsed);
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid JSON shape: ${result.error.message}`,
        });
        return undefined;
      }
      return result.data;
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: `Unparseable JSON cell: ${(e as Error).message}`,
      });
      return undefined;
    }
  };
}

export function numberCell(raw: unknown): number | undefined {
  const cleaned = cleanCell(raw);
  if (cleaned === undefined) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function boolCell(raw: unknown): boolean | undefined {
  const cleaned = cleanCell(raw);
  if (cleaned === undefined) return undefined;
  if (cleaned === '1' || cleaned.toLowerCase() === 'true') return true;
  if (cleaned === '0' || cleaned.toLowerCase() === 'false') return false;
  return undefined;
}

export type Row = Array<string | number | null | undefined>;

export function buildHeaderMap(headerRow: Row): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = cleanCell(h);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

export function rowToObject(
  row: Row,
  headerMap: Map<string, number>,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, idx] of headerMap) obj[key] = row[idx];
  return obj;
}

export interface ParseOptions {
  skipDescriptionRow?: boolean;
  tabName: string;
}

export interface ParseResult<T> {
  items: T[];
  errors: Array<{ rowIndex: number; message: string }>;
}

export function parseRows<T>(
  allRows: Row[],
  schema: z.ZodType<T>,
  opts: ParseOptions,
): ParseResult<T> {
  if (allRows.length === 0) return { items: [], errors: [] };
  const headerMap = buildHeaderMap(allRows[0]);
  const dataStart = opts.skipDescriptionRow === false ? 1 : 2;
  const items: T[] = [];
  const errors: Array<{ rowIndex: number; message: string }> = [];
  for (let i = dataStart; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.every((c) => cleanCell(c) === undefined)) continue;
    const obj = rowToObject(row, headerMap);
    const result = schema.safeParse(obj);
    if (result.success) {
      items.push(result.data);
    } else {
      errors.push({ rowIndex: i + 1, message: result.error.message });
    }
  }
  if (errors.length > 0) {
    console.warn(
      `[parse:${opts.tabName}] skipped ${errors.length} row(s):`,
      errors.slice(0, 3),
    );
  }
  return { items, errors };
}

export function isRowEmpty(row: Row): boolean {
  return !row || row.every((c) => cleanCell(c) === undefined);
}
