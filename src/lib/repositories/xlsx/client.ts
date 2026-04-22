import { promises as fs } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { Row } from '../common/parse';

const workbookCache = new Map<string, { mtimeMs: number; wb: ExcelJS.Workbook }>();

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const stat = await fs.stat(abs);
  const cached = workbookCache.get(abs);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.wb;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(abs);
  workbookCache.set(abs, { mtimeMs: stat.mtimeMs, wb });
  return wb;
}

export async function readTabRows(filePath: string, tabName: string): Promise<Row[]> {
  const wb = await loadWorkbook(filePath);
  const ws = wb.getWorksheet(tabName);
  if (!ws) return [];
  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? (row.values as unknown[]).slice(1) : [];
    rows.push(
      values.map((v) => {
        if (v === null || v === undefined) return undefined;
        if (typeof v === 'object') {
          const obj = v as {
            text?: string;
            result?: unknown;
            richText?: Array<{ text?: string }>;
          };
          if (typeof obj.text === 'string') return obj.text;
          if (obj.richText) return obj.richText.map((r) => r.text ?? '').join('');
          if ('result' in obj) return obj.result as string | number;
          if (v instanceof Date) return v.toISOString();
          return String(v);
        }
        return v as string | number;
      }),
    );
  });
  return rows;
}

export async function workbookExists(filePath: string): Promise<boolean> {
  try {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}
