import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { DataModel } from './_generated/dataModel';
import { ResendOTP } from './ResendOTP';
import { ResendOTPPasswordReset } from './ResendOTPPasswordReset';

// Domain whitelist used as the dev/local fallback when no explicit allowlist
// is configured. Production deployments MUST set `STAFF_EMAIL_ALLOWLIST` to a
// comma-separated list of staff addresses — see authorizeEmail() below.
const ALLOWED_EMAIL_DOMAINS = new Set(['amboss.com', 'medicuja.com', 'miamed.de']);

/**
 * Decide whether `email` is allowed to sign up / sign in.
 *
 * Rules:
 *   1. If `STAFF_EMAIL_ALLOWLIST` is set on the Convex deployment, the email
 *      must appear in it verbatim (case-insensitive). Domain match is
 *      irrelevant — the allowlist is the single source of truth.
 *   2. If unset, fall back to the legacy AMBOSS-domain whitelist. Intended
 *      for local dev where setting the env var on every fresh deployment
 *      would be friction.
 *
 * Production setup:
 *   npx convex env set STAFF_EMAIL_ALLOWLIST "alice@amboss.com,bob@medicuja.com"
 * Add new staff:
 *   npx convex env set STAFF_EMAIL_ALLOWLIST "alice@amboss.com,bob@medicuja.com,carol@..."
 */
function authorizeEmail(email: string): void {
  const raw = process.env.STAFF_EMAIL_ALLOWLIST;
  if (raw && raw.trim().length > 0) {
    const allowed = new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    );
    if (!allowed.has(email)) {
      throw new ConvexError(
        'Sign-in is restricted to AMBOSS staff. Contact your admin to be added to the allowlist.',
      );
    }
    return;
  }
  const at = email.indexOf('@');
  const domain = at >= 0 ? email.slice(at + 1) : '';
  if (!ALLOWED_EMAIL_DOMAINS.has(domain)) {
    throw new ConvexError(
      'Sign-in is restricted to AMBOSS staff. Please use your @amboss.com / @medicuja.com / @miamed.de address.',
    );
  }
}

const PasswordWithDomainCheck = Password<DataModel>({
  verify: ResendOTP,
  reset: ResendOTPPasswordReset,
  profile(params) {
    const email = String(params.email ?? '')
      .trim()
      .toLowerCase();
    authorizeEmail(email);
    const name = typeof params.name === 'string' ? params.name : undefined;
    return { email, ...(name ? { name } : {}) };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordWithDomainCheck],
});
