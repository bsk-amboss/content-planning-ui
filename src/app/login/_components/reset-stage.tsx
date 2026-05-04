'use client';

import {
  Button,
  Inline,
  Input,
  Link,
  PasswordInput,
  Stack,
  Text,
} from '@amboss/design-system';
import { AuthCard } from './auth-card';

export function ResetStage({
  email,
  code,
  newPassword,
  error,
  resendNotice,
  submitting,
  resending,
  onCodeChange,
  onNewPasswordChange,
  onCancel,
  onResend,
  onSubmit,
}: {
  email: string;
  code: string;
  newPassword: string;
  error: string | null;
  resendNotice: string | null;
  submitting: boolean;
  resending: boolean;
  onCodeChange: (v: string) => void;
  onNewPasswordChange: (v: string) => void;
  onCancel: () => void;
  onResend: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AuthCard
      title="Set a new password"
      description={
        <>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it along with the
          password you want to use from now on.
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
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onNewPasswordChange(e.target.value)
            }
            autoComplete="new-password"
            required
            hint="Minimum 8 characters."
            slotProps={{
              toggleVisibility: {
                ariaLabelShow: 'Show password',
                ariaLabelHide: 'Hide password',
              },
            }}
          />
          {resendNotice && <Text color="success">{resendNotice}</Text>}
          {error && (
            <Text color="error" weight="bold">
              {error}
            </Text>
          )}
          <Inline space="m" alignItems="spaceBetween" vAlignItems="center">
            <Inline space="s" vAlignItems="center">
              <Link as="button" type="button" color="tertiary" onClick={onCancel}>
                Cancel
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
            <Button
              type="submit"
              disabled={submitting || code.length !== 6 || newPassword.length < 8}
            >
              {submitting ? 'Saving…' : 'Set password'}
            </Button>
          </Inline>
        </Stack>
      </form>
    </AuthCard>
  );
}
