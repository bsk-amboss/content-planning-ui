import type { sheets_v4 } from 'googleapis';
import { google } from 'googleapis';
import { env } from '@/env';
import type { Row } from '../common/parse';

let cachedClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const clientEmail = env.GOOGLE_SA_CLIENT_EMAIL;
  const privateKey = env.GOOGLE_SA_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Sheets credentials missing. Set GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY.',
    );
  }
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  cachedClient = google.sheets({ version: 'v4', auth: jwt });
  return cachedClient;
}

export async function readTabRows(sheetId: string, tabName: string): Promise<Row[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName.replace(/'/g, "''")}'`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = res.data.values ?? [];
  return values.map((row) =>
    row.map((c) => (c === null || c === undefined ? undefined : c)),
  );
}
