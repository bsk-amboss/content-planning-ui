/**
 * Issue a short-lived Vercel Blob upload token for client uploads.
 *
 * The browser calls `upload()` from `@vercel/blob/client`, which POSTs here
 * to obtain the token, then streams the file directly to Blob storage. Server
 * never holds the file bytes — scales well for large PDFs.
 */

import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { type NextRequest, NextResponse } from 'next/server';
import { requireUserResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const guard = await requireUserResponse();
  if (guard) return guard;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Vercel Blob not configured. Connect Blob storage in the Vercel dashboard and run `vercel env pull .env.local`, then restart the dev server.',
      },
      { status: 501 },
    );
  }
  const body = (await req.json()) as HandleUploadBody;
  try {
    const res = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf'],
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('[blob] upload completed', {
          url: blob.url,
          pathname: blob.pathname,
        });
      },
    });
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[blob] upload-token failed:', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
