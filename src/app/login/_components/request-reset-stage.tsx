'use client';

import { Button, Inline, Input, Link, Stack, Text } from '@amboss/design-system';
import { AuthCard } from './auth-card';

export function RequestResetStage({
  email,
  error,
  submitting,
  onEmailChange,
  onBack,
  onSubmit,
}: {
  email: string;
  error: string | null;
  submitting: boolean;
  onEmailChange: (v: string) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AuthCard
      title="Reset password"
      description="Enter your email and we'll send you a 6-digit code to set a new password."
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack space="m">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onEmailChange(e.target.value)
            }
            autoComplete="email"
            required
          />
          {error && (
            <Text color="error" weight="bold">
              {error}
            </Text>
          )}
          <Inline space="m" alignItems="spaceBetween" vAlignItems="center">
            <Link as="button" type="button" color="tertiary" onClick={onBack}>
              Back to sign in
            </Link>
            <Button type="submit" disabled={submitting || !email.includes('@')}>
              {submitting ? 'Sending…' : 'Send reset code'}
            </Button>
          </Inline>
        </Stack>
      </form>
    </AuthCard>
  );
}
