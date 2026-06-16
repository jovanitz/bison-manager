import { useState, type FormEvent } from 'react';
import { useUseCases } from '../../di/use-cases-context';

/**
 * Public activation screen (no auth): the invitee arrives via the activation
 * link, which carries the secret token in the URL fragment (`#token=…`). The
 * fragment never reaches a server, so it stays out of logs. They set a password;
 * the server validates the token and provisions the identity. On success they
 * sign in normally — the existing onboarding attaches them via the invitation.
 */
const tokenFromHash = (): string => {
  const hash = window.location.hash.replace(/^#/, '');
  return new URLSearchParams(hash).get('token') ?? '';
};

type ActivatePhase =
  | { readonly kind: 'form' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'done'; readonly email: string };

export const ActivateInvitationScreen = () => {
  const { invitations } = useUseCases();
  const [token] = useState(tokenFromHash);
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<ActivatePhase>({ kind: 'form' });

  if (!invitations) {
    return <p>Invitation use cases are not wired in this app yet.</p>;
  }
  if (!token) {
    return <p role="alert">This activation link is missing its token.</p>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPhase({ kind: 'busy' });
    const result = await invitations.activate({ token, password });
    if (!result.ok) {
      setPhase({ kind: 'error', message: result.error.message });
      return;
    }
    setPhase({ kind: 'done', email: result.value.email });
  };

  if (phase.kind === 'done') {
    return (
      <section aria-label="activated">
        <h1>Account activated</h1>
        <p>
          {phase.email} is ready. <a href="/">Go to sign in</a>.
        </p>
      </section>
    );
  }

  return (
    <form aria-label="activate" onSubmit={(e) => void submit(e)}>
      <h1>Activate your invitation</h1>
      <label>
        New password
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={phase.kind === 'busy'}>
        Activate
      </button>
      {phase.kind === 'error' ? <p role="alert">{phase.message}</p> : null}
    </form>
  );
};
