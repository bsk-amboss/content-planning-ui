import { Email } from '@convex-dev/auth/providers/Email';
import type { GenericActionCtx } from 'convex/server';
import { ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';

// Custom Email-based provider used by the Password provider's `reset` slot
// (see convex/auth.ts). Sends a 6-digit OTP that the user enters along with
// a new password to complete the reset. Same Resend transport as ResendOTP;
// kept as a separate file so the email subject/body can be tuned without
// touching the verification flow.
//
// Env: shares RESEND_API_KEY with ResendOTP.

type ActionCtx = GenericActionCtx<DataModel>;

export const ResendOTPPasswordReset = Email({
  id: 'resend-otp-password-reset',
  maxAge: 60 * 10,
  generateVerificationToken() {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    const n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
    return (n % 1_000_000).toString().padStart(6, '0');
  },
  async sendVerificationRequest(
    { identifier: email, token, expires },
    // See ResendOTP.ts for the rationale on accepting ctx as a 2nd arg.
    ctx?: ActionCtx,
  ) {
    if (!ctx?.runMutation) {
      throw new ConvexError('OTP rate limiter unavailable — refusing to send.');
    }
    await ctx.runMutation(internal.otpRateLimit.checkAndRecord, { email });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new ConvexError(
        'Email is not configured. Set RESEND_API_KEY on the Convex deployment.',
      );
    }

    const minutes = Math.max(1, Math.round((expires.getTime() - Date.now()) / 60000));
    const subject = `${token} is your AMBOSS Content Planner password-reset code`;
    const text = [
      `Use this code to reset your AMBOSS Content Planner password: ${token}`,
      `It expires in ${minutes} minutes.`,
      '',
      "If you didn't request a password reset, you can ignore this email — your current password still works.",
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <p>Use this code to reset your AMBOSS Content Planner password</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${token}</p>
        <p>It expires in ${minutes} minutes.</p>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          If you didn't request a password reset, you can ignore this email — your current password still works.
        </p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AMBOSS Content Planner <onboarding@resend.dev>',
        to: [email],
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ConvexError(
        `Resend API error (${response.status}): ${body.slice(0, 300)}`,
      );
    }
  },
});
