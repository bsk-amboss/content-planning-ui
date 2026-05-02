'use client';

import {
  Box,
  Button,
  Card,
  H1,
  Inline,
  Input,
  Link,
  PasswordInput,
  Stack,
  Text,
} from '@amboss/design-system';
import { useAuthActions } from '@convex-dev/auth/react';
import { ConvexError } from 'convex/values';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

// After a successful sign-in we need a *hard* navigation, not router.replace.
// Two reasons: (1) router.replace inside the same React commit as the auth
// state change can be silently dropped under Cache Components, and (2) a
// hard navigation guarantees the proxy/middleware reads the freshly-set
// auth cookie on the next request, eliminating any stale-token race.
function navigateAfterAuth(target: string) {
  window.location.assign(target);
}

type Flow = 'signIn' | 'signUp';
type Stage = 'credentials' | 'code' | 'requestReset' | 'reset';

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>('credentials');
  const [flow, setFlow] = useState<Flow>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  function readError(err: unknown, fallback: string) {
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

  function clearTransient() {
    setError(null);
    setResendNotice(null);
  }

  async function onCredentialsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTransient();
    setSubmitting(true);
    try {
      const result = await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow,
        ...(flow === 'signUp' && name.trim() ? { name: name.trim() } : {}),
      });
      // verify is enabled, so signUp (and sign-in for unverified accounts)
      // returns signingIn:false and sends a code to the user's inbox.
      if (result.signingIn) {
        navigateAfterAuth(searchParams.get('next') ?? '/');
      } else {
        setStage('code');
        setCode('');
      }
    } catch (err) {
      setError(readError(err, 'Sign-in failed. Check your email and password.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTransient();
    setSubmitting(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        flow: 'email-verification',
      });
      navigateAfterAuth(searchParams.get('next') ?? '/');
    } catch (err) {
      setError(readError(err, 'Verification failed. Try the code again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    clearTransient();
    setResending(true);
    try {
      // Re-running the original sign-in/sign-up call triggers a fresh OTP.
      // Use signIn (not signUp) for the resend so we don't try to create the
      // account a second time after sign-up; the server's verify branch
      // (Password.js:149-156) re-sends the code for unverified accounts.
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: 'signIn',
      });
      setResendNotice(`We sent a new code to ${email}.`);
    } catch (err) {
      setError(readError(err, 'Could not resend the code. Try again in a minute.'));
    } finally {
      setResending(false);
    }
  }

  async function onRequestResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTransient();
    setSubmitting(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        flow: 'reset',
      });
      setStage('reset');
      setCode('');
      setNewPassword('');
    } catch (err) {
      setError(
        readError(
          err,
          "Couldn't start the reset. Check the email address and try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTransient();
    setSubmitting(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
        flow: 'reset-verification',
      });
      navigateAfterAuth(searchParams.get('next') ?? '/');
    } catch (err) {
      setError(readError(err, 'Reset failed. Try the code again or request a new one.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetResend() {
    clearTransient();
    setResending(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        flow: 'reset',
      });
      setResendNotice(`We sent a new reset code to ${email}.`);
    } catch (err) {
      setError(readError(err, 'Could not resend the code. Try again in a minute.'));
    } finally {
      setResending(false);
    }
  }

  function backToCredentials() {
    setStage('credentials');
    setCode('');
    setNewPassword('');
    clearTransient();
  }

  function startReset() {
    setStage('requestReset');
    setPassword('');
    setCode('');
    setNewPassword('');
    clearTransient();
  }

  if (stage === 'code') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto' }}>
        <Card outlined>
          <Box space="l">
            <Stack space="l">
              <Stack space="xs">
                <H1>Check your inbox</H1>
                <Text color="secondary">
                  We sent a 6-digit code to <strong>{email}</strong>. It expires in 10
                  minutes.
                </Text>
              </Stack>

              <form onSubmit={onCodeSubmit} noValidate>
                <Stack space="m">
                  <Input
                    label="6-digit code"
                    value={code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
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
                      <Link
                        as="button"
                        type="button"
                        color="tertiary"
                        onClick={backToCredentials}
                      >
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
            </Stack>
          </Box>
        </Card>
      </div>
    );
  }

  if (stage === 'requestReset') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto' }}>
        <Card outlined>
          <Box space="l">
            <Stack space="l">
              <Stack space="xs">
                <H1>Reset password</H1>
                <Text color="secondary">
                  Enter your email and we'll send you a 6-digit code to set a new
                  password.
                </Text>
              </Stack>

              <form onSubmit={onRequestResetSubmit} noValidate>
                <Stack space="m">
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
                  {error && (
                    <Text color="error" weight="bold">
                      {error}
                    </Text>
                  )}
                  <Inline space="m" alignItems="spaceBetween" vAlignItems="center">
                    <Link
                      as="button"
                      type="button"
                      color="tertiary"
                      onClick={backToCredentials}
                    >
                      Back to sign in
                    </Link>
                    <Button type="submit" disabled={submitting || !email.includes('@')}>
                      {submitting ? 'Sending…' : 'Send reset code'}
                    </Button>
                  </Inline>
                </Stack>
              </form>
            </Stack>
          </Box>
        </Card>
      </div>
    );
  }

  if (stage === 'reset') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto' }}>
        <Card outlined>
          <Box space="l">
            <Stack space="l">
              <Stack space="xs">
                <H1>Set a new password</H1>
                <Text color="secondary">
                  We sent a 6-digit code to <strong>{email}</strong>. Enter it along with
                  the password you want to use from now on.
                </Text>
              </Stack>

              <form onSubmit={onResetSubmit} noValidate>
                <Stack space="m">
                  <Input
                    label="6-digit code"
                    value={code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
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
                      setNewPassword(e.target.value)
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
                      <Link
                        as="button"
                        type="button"
                        color="tertiary"
                        onClick={backToCredentials}
                      >
                        Cancel
                      </Link>
                      <Text color="secondary">·</Text>
                      <Link
                        as="button"
                        type="button"
                        color="tertiary"
                        onClick={onResetResend}
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
            </Stack>
          </Box>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '64px auto' }}>
      <Card outlined>
        <Box space="l">
          <Stack space="l">
            <Stack space="xs">
              <H1>{flow === 'signIn' ? 'Sign in' : 'Create account'}</H1>
              <Text color="secondary">
                AMBOSS staff only — use your @amboss.com, @medicuja.com, or @miamed.de
                email.
              </Text>
            </Stack>

            <form onSubmit={onCredentialsSubmit} noValidate>
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
                {flow === 'signIn' && (
                  <Inline alignItems="right">
                    <Link as="button" type="button" color="tertiary" onClick={startReset}>
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
                  <Button
                    variant="tertiary"
                    type="button"
                    onClick={() => {
                      clearTransient();
                      setFlow(flow === 'signIn' ? 'signUp' : 'signIn');
                    }}
                  >
                    {flow === 'signIn' ? 'Create account' : 'Have an account? Sign in'}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Working…' : flow === 'signIn' ? 'Sign in' : 'Sign up'}
                  </Button>
                </Inline>
              </Stack>
            </form>
          </Stack>
        </Box>
      </Card>
    </div>
  );
}
