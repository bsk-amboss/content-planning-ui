'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CodeStage } from './_components/code-stage';
import { CredentialsStage } from './_components/credentials-stage';
import { RequestResetStage } from './_components/request-reset-stage';
import { ResetStage } from './_components/reset-stage';
import { mapAuthError } from './_lib/error-mapping';
import { navigateAfterAuth, safeRedirectTarget } from './_lib/safe-redirect';
import type { Flow, Stage } from './_lib/types';

/**
 * Login state machine. Owns the form state shared across the four stages
 * (`credentials`, `code`, `requestReset`, `reset`) and dispatches
 * `signIn` calls to Convex Auth's Password provider. Each stage is a
 * separate component under `_components/` that renders its own form.
 */
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
        navigateAfterAuth(safeRedirectTarget(searchParams.get('next')));
      } else {
        setStage('code');
        setCode('');
      }
    } catch (err) {
      setError(mapAuthError(err, flow, 'Sign-in failed. Check your email and password.'));
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
      navigateAfterAuth(safeRedirectTarget(searchParams.get('next')));
    } catch (err) {
      setError(mapAuthError(err, flow, 'Verification failed. Try the code again.'));
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
      setError(
        mapAuthError(err, flow, 'Could not resend the code. Try again in a minute.'),
      );
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
        mapAuthError(
          err,
          flow,
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
      navigateAfterAuth(safeRedirectTarget(searchParams.get('next')));
    } catch (err) {
      setError(
        mapAuthError(err, flow, 'Reset failed. Try the code again or request a new one.'),
      );
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
      setError(
        mapAuthError(err, flow, 'Could not resend the code. Try again in a minute.'),
      );
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
      <CodeStage
        email={email}
        code={code}
        error={error}
        resendNotice={resendNotice}
        submitting={submitting}
        resending={resending}
        onCodeChange={setCode}
        onBack={backToCredentials}
        onResend={onResend}
        onSubmit={onCodeSubmit}
      />
    );
  }

  if (stage === 'requestReset') {
    return (
      <RequestResetStage
        email={email}
        error={error}
        submitting={submitting}
        onEmailChange={setEmail}
        onBack={backToCredentials}
        onSubmit={onRequestResetSubmit}
      />
    );
  }

  if (stage === 'reset') {
    return (
      <ResetStage
        email={email}
        code={code}
        newPassword={newPassword}
        error={error}
        resendNotice={resendNotice}
        submitting={submitting}
        resending={resending}
        onCodeChange={setCode}
        onNewPasswordChange={setNewPassword}
        onCancel={backToCredentials}
        onResend={onResetResend}
        onSubmit={onResetSubmit}
      />
    );
  }

  return (
    <CredentialsStage
      flow={flow}
      email={email}
      password={password}
      name={name}
      error={error}
      submitting={submitting}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onNameChange={setName}
      onToggleFlow={() => {
        clearTransient();
        setFlow(flow === 'signIn' ? 'signUp' : 'signIn');
      }}
      onForgotPassword={startReset}
      onSubmit={onCredentialsSubmit}
    />
  );
}
