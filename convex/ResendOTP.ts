import { Email } from '@convex-dev/auth/providers/Email';
import { ConvexError } from 'convex/values';

// Custom Email-based provider that sends a 6-digit OTP via Resend.
// Wired into the Password provider's `verify` slot in convex/auth.ts so
// sign-up requires email-ownership before the account is created. Auth.js
// re-checks the original email on code submission (via the default
// authorize behaviour) so a leaked OTP still requires the matching email.
//
// Env: RESEND_API_KEY must be set on the Convex deployment
// (`npx convex env set RESEND_API_KEY <key>`). Until prod has a verified
// domain, the from-address is `onboarding@resend.dev`, which Resend allows
// for testing without DNS.
export const ResendOTP = Email({
  id: 'resend-otp',
  maxAge: 60 * 10,
  generateVerificationToken() {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    const n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
    return (n % 1_000_000).toString().padStart(6, '0');
  },
  async sendVerificationRequest({ identifier: email, token, expires }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new ConvexError(
        'Email verification is not configured. Set RESEND_API_KEY on the Convex deployment.',
      );
    }

    const minutes = Math.max(1, Math.round((expires.getTime() - Date.now()) / 60000));
    const subject = `${token} is your AMBOSS Content Planner code`;
    const text = [
      `Your one-time sign-in code is ${token}.`,
      `It expires in ${minutes} minutes.`,
      '',
      "If you didn't request this, you can ignore this email.",
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <p>Your one-time sign-in code is</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${token}</p>
        <p>It expires in ${minutes} minutes.</p>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
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
