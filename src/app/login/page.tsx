'use client';

import {
  Button,
  Card,
  H1,
  Inline,
  Input,
  PasswordInput,
  Stack,
  Text,
} from '@amboss/design-system';
import { useAuthActions } from '@convex-dev/auth/react';
import { ConvexError } from 'convex/values';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Flow = 'signIn' | 'signUp';

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<Flow>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow,
        ...(flow === 'signUp' && name.trim() ? { name: name.trim() } : {}),
      });
      const next = searchParams.get('next') ?? '/';
      router.replace(next);
    } catch (err: unknown) {
      // ConvexError from the profile callback (e.g. domain allowlist) carries
      // a string in `data`. Auth.js credential errors arrive as plain Error
      // with messages like "InvalidAccountId" / "InvalidSecret".
      let message = 'Sign-in failed. Check your email and password.';
      if (err instanceof ConvexError && typeof err.data === 'string') {
        message = err.data;
      } else if (err instanceof Error && err.message) {
        if (/InvalidAccountId|InvalidSecret/.test(err.message)) {
          message =
            flow === 'signIn'
              ? 'Email or password is incorrect.'
              : 'Could not create account — the email may already be registered.';
        } else {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '64px auto' }}>
      <Card outlined>
        <Stack space="l">
          <Stack space="xs">
            <H1>{flow === 'signIn' ? 'Sign in' : 'Create account'}</H1>
            <Text color="secondary">
              AMBOSS staff only — use your @amboss.com, @medicuja.com, or @miamed.de email.
            </Text>
          </Stack>

          <form onSubmit={onSubmit} noValidate>
            <Stack space="m">
              {flow === 'signUp' && (
                <Input
                  label="Name"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setName(e.target.value)
                  }
                  autoComplete="name"
                />
              )}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                autoComplete="email"
                required
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
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
              {error && (
                <Text color="error" weight="bold">
                  {error}
                </Text>
              )}
              <Inline space="m" alignItems="spaceBetween" vAlignItems="center">
                <Button
                  variant="tertiary"
                  type="button"
                  onClick={() => {
                    setError(null);
                    setFlow(flow === 'signIn' ? 'signUp' : 'signIn');
                  }}
                >
                  {flow === 'signIn' ? 'Create account' : 'Have an account? Sign in'}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? 'Working…'
                    : flow === 'signIn'
                      ? 'Sign in'
                      : 'Sign up'}
                </Button>
              </Inline>
            </Stack>
          </form>
        </Stack>
      </Card>
    </div>
  );
}
