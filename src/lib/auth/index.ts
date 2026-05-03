import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from '@convex-dev/auth/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { NextResponse } from 'next/server';
import { api } from '../../../convex/_generated/api';

export type CurrentUser = {
  _id: string;
  email: string | null;
  name: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  const user = await fetchQuery(api.users.getCurrentUser, {}, { token });
  return user as CurrentUser | null;
}

export async function isAuthenticated(): Promise<boolean> {
  return isAuthenticatedNextjs();
}

/**
 * Guard for API route handlers. The proxy at `src/proxy.ts` only redirects
 * unauthenticated GETs (POSTs need to fall through for the auth handshake and
 * the Convex Auth `invalidateCache` Server Action), so every mutating route
 * MUST call this at the top of its handler.
 *
 *   export async function POST(req: NextRequest) {
 *     const guard = await requireUserResponse();
 *     if (guard) return guard;
 *     // … handler
 *   }
 */
export async function requireUserResponse(): Promise<NextResponse | null> {
  if (await isAuthenticatedNextjs()) return null;
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
