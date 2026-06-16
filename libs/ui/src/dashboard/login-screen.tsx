import { useState, type FormEvent } from 'react';
import { useUseCases } from '../di/use-cases-context';

/**
 * Dashboard sign-in — login only. There is no registration: staff accounts are
 * created by invitation, never self-service. On success the auth provider fires
 * its change event and `RequireAdmin` re-resolves into the dashboard, so this
 * screen only owns the credential form and its error.
 */
export const DashboardLoginScreen = ({
  notice,
}: {
  /** Shown above the form, e.g. when a signed-in user lacks admin access. */
  readonly notice?: string;
}) => {
  const { access } = useUseCases();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!access) {
    return <p>Access use cases are not wired in this app yet.</p>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await access.signIn({ email, password });
    setBusy(false);
    if (!result.ok) setError(result.error.message);
  };

  return (
    <form aria-label="login" onSubmit={(e) => void submit(e)}>
      <h1>Staff sign in</h1>
      {notice ? <p role="status">{notice}</p> : null}
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        Sign in
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
};
