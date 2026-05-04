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
import type { Flow } from '../_lib/types';
import { AuthCard } from './auth-card';

export function CredentialsStage({
  flow,
  email,
  password,
  name,
  error,
  submitting,
  onEmailChange,
  onPasswordChange,
  onNameChange,
  onToggleFlow,
  onForgotPassword,
  onSubmit,
}: {
  flow: Flow;
  email: string;
  password: string;
  name: string;
  error: string | null;
  submitting: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onToggleFlow: () => void;
  onForgotPassword: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AuthCard
      title={flow === 'signIn' ? 'Sign in' : 'Create account'}
      description="AMBOSS staff only — use your @amboss.com, @medicuja.com, or @miamed.de email."
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack space="m">
          {flow === 'signUp' && (
            <Input
              label="Name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onNameChange(e.target.value)
              }
              autoComplete="name"
            />
          )}
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
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onPasswordChange(e.target.value)
            }
            autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
            required
            hint={flow === 'signUp' ? 'Minimum 8 characters.' : undefined}
            slotProps={{
              toggleVisibility: {
                ariaLabelShow: 'Show password',
                ariaLabelHide: 'Hide password',
              },
            }}
          />
          {flow === 'signIn' && (
            <Inline alignItems="right">
              <Link as="button" type="button" color="tertiary" onClick={onForgotPassword}>
                Forgot password?
              </Link>
            </Inline>
          )}
          {error && (
            <Text color="error" weight="bold">
              {error}
            </Text>
          )}
          <Inline space="m" alignItems="spaceBetween" vAlignItems="center">
            <Button variant="tertiary" type="button" onClick={onToggleFlow}>
              {flow === 'signIn' ? 'Create account' : 'Have an account? Sign in'}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Working…' : flow === 'signIn' ? 'Sign in' : 'Sign up'}
            </Button>
          </Inline>
        </Stack>
      </form>
    </AuthCard>
  );
}
