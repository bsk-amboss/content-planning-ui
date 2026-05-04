import { ConvexError } from 'convex/values';
import type { Flow } from './types';

/**
 * Translate a thrown error from Convex Auth into a user-readable message.
 * Convex returns its own typed errors (`ConvexError` with a `.data` payload)
 * but the Password provider also throws plain `Error`s with messages like
 * `InvalidAccountId`/`InvalidSecret` that we need to map to friendly copy.
 */
export function mapAuthError(err: unknown, flow: Flow, fallback: string): string {
  if (err instanceof ConvexError && typeof err.data === 'string') {
    return err.data;
  }
  if (err instanceof Error && err.message) {
    if (/InvalidAccountId|InvalidSecret/.test(err.message)) {
      return flow === 'signIn'
        ? 'Email or password is incorrect.'
        : 'Could not create account — the email may already be registered.';
    }
    if (
      /Could not verify code|verification code|verifier|Invalid code/i.test(err.message)
    ) {
      return 'That code is invalid or expired. Try again or request a new one.';
    }
    return err.message;
  }
  return fallback;
}
