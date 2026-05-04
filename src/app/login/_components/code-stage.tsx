'use client';

import { Button, Inline, Input, Link, Stack, Text } from '@amboss/design-system';
import { AuthCard } from './auth-card';

export function CodeStage({
  email,
  code,
  error,
  resendNotice,
  submitting,
  resending,
  onCodeChange,
  onBack,
  onResend,
  onSubmit,
}: {
  email: string;
  code: string;
  error: string | null;
  resendNotice: string | null;
  submitting: boolean;
  resending: boolean;
  onCodeChange: (v: string) => void;
  onBack: () => void;
  onResend: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AuthCard
      title="Check your inbox"
      description={
        <>
          We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack space="m">
          <Input
            label="6-digit code"
            value={code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
          {resendNotice && <Text color="success">{resendNotice}</Text>}
          {error && (
            <Text color="error" weight="bold">
              {error}
            </Text>
          )}
          <Inline space="m" alignItems="spaceBetween" vAlignItems="center">
            <Inline space="s" vAlignItems="center">
              <Link as="button" type="button" color="tertiary" onClick={onBack}>
                Use a different email
              </Link>
              <Text color="secondary">·</Text>
              <Link
                as="button"
                type="button"
                color="tertiary"
                onClick={onResend}
                disabled={resending || submitting}
              >
                {resending ? 'Sending…' : 'Resend code'}
              </Link>
            </Inline>
            <Button type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? 'Verifying…' : 'Verify'}
            </Button>
          </Inline>
        </Stack>
      </form>
    </AuthCard>
  );
}
