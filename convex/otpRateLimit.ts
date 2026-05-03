/**
 * Per-email rate limiter for the OTP send paths (verification + password
 * reset). Convex Auth ships with no rate limiting on `sendVerificationRequest`
 * — without this, an attacker can spam any allowlisted email with codes,
 * burning Resend credits and flooding the user's inbox.
 *
 * Strategy: fixed-window counter per email. The window resets the first time
 * a request arrives more than WINDOW_MS after the previous window started.
 * 5 requests / 10 minutes is generous enough that legitimate "didn't get the
 * code, resend" loops succeed, but tight enough to make abuse impractical.
 *
 * Called from `convex/ResendOTP.ts` and `convex/ResendOTPPasswordReset.ts` via
 * `ctx.runMutation(internal.otpRateLimit.checkAndRecord, …)`.
 */

import { ConvexError, v } from 'convex/values';
import { internalMutation } from './_generated/server';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;

export const checkAndRecord = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const now = Date.now();
    const row = await ctx.db
      .query('otpRateLimit')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    if (!row) {
      await ctx.db.insert('otpRateLimit', { email, windowStart: now, count: 1 });
      return;
    }

    if (now - row.windowStart >= WINDOW_MS) {
      // Stale window — reset.
      await ctx.db.patch(row._id, { windowStart: now, count: 1 });
      return;
    }

    if (row.count >= MAX_REQUESTS) {
      const minutesLeft = Math.ceil((WINDOW_MS - (now - row.windowStart)) / 60000);
      throw new ConvexError(
        `Too many code requests. Try again in ${minutesLeft} minute${
          minutesLeft === 1 ? '' : 's'
        }.`,
      );
    }

    await ctx.db.patch(row._id, { count: row.count + 1 });
  },
});
