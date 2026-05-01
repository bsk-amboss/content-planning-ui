import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { DataModel } from './_generated/dataModel';

const ALLOWED_EMAIL_DOMAINS = new Set(['amboss.com', 'medicuja.com', 'miamed.de']);

const PasswordWithDomainCheck = Password<DataModel>({
  profile(params) {
    const email = String(params.email ?? '')
      .trim()
      .toLowerCase();
    const at = email.indexOf('@');
    const domain = at >= 0 ? email.slice(at + 1) : '';
    if (!ALLOWED_EMAIL_DOMAINS.has(domain)) {
      throw new ConvexError(
        'Sign-in is restricted to AMBOSS staff. Please use your @amboss.com / @medicuja.com / @miamed.de address.',
      );
    }
    const name = typeof params.name === 'string' ? params.name : undefined;
    return { email, ...(name ? { name } : {}) };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordWithDomainCheck],
});
