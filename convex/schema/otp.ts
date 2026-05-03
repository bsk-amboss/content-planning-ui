import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// Per-email OTP request counter. Written from an internal mutation called
// by the Email provider's `sendVerificationRequest` hook before each send.
// One row per email; the row's window resets when older than the limit
// duration (see convex/otpRateLimit.ts). Doesn't carry an expiration —
// entries naturally fall out of relevance once their window expires.

export const otpTables = {
  otpRateLimit: defineTable({
    email: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_email', ['email']),
};
