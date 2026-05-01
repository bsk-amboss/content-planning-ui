import { convexAuthNextjsToken, isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
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
