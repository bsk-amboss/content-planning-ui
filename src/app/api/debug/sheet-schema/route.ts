import { NextResponse } from 'next/server';
import { env } from '@/env';
import { requireUserResponse } from '@/lib/auth';
import { getSpecialtyRegistry } from '@/lib/repositories';
import { readTabRows as readSheetsTab } from '@/lib/repositories/sheets/client';
import { readTabRows as readXlsxTab } from '@/lib/repositories/xlsx/client';

export async function GET(request: Request) {
  if (env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }
  const guard = await requireUserResponse();
  if (guard) return guard;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const tab = url.searchParams.get('tab');
  if (!slug || !tab) {
    return NextResponse.json(
      { error: 'Usage: /api/debug/sheet-schema?slug=<slug>&tab=<TabName>' },
      { status: 400 },
    );
  }

  const specialties = getSpecialtyRegistry();
  const specialty = specialties.find((s) => s.slug === slug);
  if (!specialty) {
    return NextResponse.json(
      {
        error: `Unknown slug "${slug}". Registered: ${specialties.map((s) => s.slug).join(', ')}`,
      },
      { status: 404 },
    );
  }

  let rows: Array<Array<unknown>>;
  try {
    if (specialty.source === 'sheets' && specialty.sheetId) {
      rows = await readSheetsTab(specialty.sheetId, tab);
    } else if (specialty.source === 'xlsx' && specialty.xlsxPath) {
      rows = await readXlsxTab(specialty.xlsxPath, tab);
    } else {
      return NextResponse.json(
        { error: 'Specialty has no backing source.' },
        { status: 500 },
      );
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const header = rows[0] ?? [];
  const descriptions = rows[1] ?? [];
  const samples = rows.slice(2, 5);
  const inferredTypes = header.map((_, i) => {
    for (const r of samples) {
      const cell = r[i];
      if (cell === undefined || cell === null || cell === '') continue;
      return typeof cell;
    }
    return 'unknown';
  });

  return NextResponse.json({
    slug,
    tab,
    source: specialty.source,
    totalRows: rows.length,
    header,
    descriptions,
    samples,
    inferredTypes,
  });
}
