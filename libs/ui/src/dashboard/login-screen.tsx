import { useEffect, useState, type FormEvent } from 'react';
import type { AccessClientUseCases } from '@acme/application';
import { useUseCases } from '../di/use-cases-context';

/**
 * First-run check (pre-auth): true only while the instance has no root admin —
 * the one moment the dashboard offers an owner sign-up. Self-correcting if the
 * component unmounts mid-flight.
 */
const useNeedsBootstrap = (
  access: AccessClientUseCases | undefined,
): boolean => {
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  useEffect(() => {
    if (!access) return;
    let active = true;
    void access.needsBootstrap().then((result) => {
      if (active && result.ok) setNeedsBootstrap(result.value);
    });
    return () => {
      active = false;
    };
  }, [access]);
  return needsBootstrap;
};

/**
 * Dashboard sign-in. Normally login-only — staff accounts are created by
 * invitation, never self-service. The ONE exception is first-run: while no root
 * admin exists, the screen also offers a one-time owner sign-up (the server's
 * `rootAdminExists` guard is the real gate; this only shows the button on a
 * fresh instance). On success the auth provider fires its change event and
 * `RequireAdmin` re-resolves into the dashboard.
 */
export const DashboardLoginScreen = ({
  notice,
}: {
  /** Shown above the form, e.g. when a signed-in user lacks admin access. */
  readonly notice?: string;
}) => {
  const { access } = useUseCases();
  const needsBootstrap = useNeedsBootstrap(access);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!access) {
    return <p>Access use cases are not wired in this app yet.</p>;
  }

  const submit = async (event: FormEvent, flow: 'signIn' | 'signUp') => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result =
      flow === 'signUp'
        ? await access.signUp({ email, password })
        : await access.signIn({ email, password });
    setBusy(false);
    if (!result.ok) setError(result.error.message);
  };

  return (
    <form aria-label="login" onSubmit={(e) => void submit(e, 'signIn')}>
      <h1>Staff sign in</h1>
      {notice ? <p role="status">{notice}</p> : null}
      {needsBootstrap ? (
        <p role="status">
          No owner exists yet — create the first one to claim this instance.
        </p>
      ) : null}
      <label>
        Email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        Sign in
      </button>
      {needsBootstrap ? (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => void submit(e, 'signUp')}
        >
          Create the first owner
        </button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
};
