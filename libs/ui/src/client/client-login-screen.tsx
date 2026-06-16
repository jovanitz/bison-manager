import { useState, type FormEvent } from 'react';
import { useUseCases } from '../di/use-cases-context';

type Flow = 'signIn' | 'signUp';

/**
 * Customer-facing auth: sign in OR self-register. Unlike the staff dashboard,
 * the client app DOES offer "Create account" — a new identity is provisioned
 * into its own organization on first login (or joins one it was invited to).
 * On success the auth provider fires its change event and the session gate
 * re-resolves into the home screen.
 */
export const ClientLoginScreen = () => {
  const { access } = useUseCases();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!access) {
    return <p>Access use cases are not wired in this app yet.</p>;
  }

  const run = async (flow: Flow, event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await access[flow]({ email, password });
    setBusy(false);
    if (!result.ok) setError(result.error.message);
  };

  return (
    <form aria-label="client login" onSubmit={(e) => void run('signIn', e)}>
      <h1>Welcome</h1>
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
      <button
        type="button"
        disabled={busy}
        onClick={(e) => void run('signUp', e)}
      >
        Create account
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
};
