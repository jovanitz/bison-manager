import { useState, type FormEvent } from 'react';
import type { CurrentAccessDto } from '@acme/application';
import { useUseCases } from '../di/use-cases-context';

/**
 * Functional skeleton, deliberately unstyled: it exists to exercise the whole
 * auth arc (sign in/up → bearer token → access.current → permission gating)
 * end to end. Product screens replace this; the use cases they consume are
 * exactly the ones proven here.
 */
type AccessLoginPhase =
  | { readonly kind: 'signed-out'; readonly error?: string }
  | { readonly kind: 'busy' }
  | { readonly kind: 'signed-in'; readonly access: CurrentAccessDto };

type AccessAuthFlow = 'signIn' | 'signUp';

const AccessSnapshotPanel = (props: {
  readonly access: CurrentAccessDto;
  readonly onSignOut: () => void;
}) => (
  <section aria-label="current access">
    <h1>Signed in</h1>
    <p data-testid="account-status">
      Account {props.access.accountId} — {props.access.accountStatus}
    </p>
    <ul aria-label="permissions">
      {props.access.permissions.map((p) => (
        <li key={`${p.action}:${p.scope}`}>
          {p.action} ({p.scope})
        </li>
      ))}
    </ul>
    <button type="button" onClick={props.onSignOut}>
      Sign out
    </button>
  </section>
);

const AccessCredentialsForm = (props: {
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly onSubmit: (
    flow: AccessAuthFlow,
    email: string,
    password: string,
  ) => void;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent, flow: AccessAuthFlow) => {
    event.preventDefault();
    props.onSubmit(flow, email, password);
  };
  return (
    <form aria-label="login" onSubmit={(e) => submit(e, 'signIn')}>
      <h1>Sign in</h1>
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
      <button type="submit" disabled={props.busy}>
        Sign in
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={(e) => submit(e, 'signUp')}
      >
        Create account
      </button>
      {props.error ? <p role="alert">{props.error}</p> : null}
    </form>
  );
};

export const AccessLoginScreen = () => {
  const { access } = useUseCases();
  const [phase, setPhase] = useState<AccessLoginPhase>({ kind: 'signed-out' });

  if (!access) {
    return <p>Access use cases are not wired in this app yet.</p>;
  }

  const authenticate = async (
    flow: AccessAuthFlow,
    email: string,
    password: string,
  ) => {
    setPhase({ kind: 'busy' });
    const result = await access[flow]({ email, password });
    if (!result.ok) {
      setPhase({ kind: 'signed-out', error: result.error.message });
      return;
    }
    const snapshot = await access.currentAccess();
    if (!snapshot.ok) {
      setPhase({ kind: 'signed-out', error: snapshot.error.message });
      return;
    }
    setPhase({ kind: 'signed-in', access: snapshot.value });
  };

  const signOut = async () => {
    await access.signOut();
    setPhase({ kind: 'signed-out' });
  };

  return phase.kind === 'signed-in' ? (
    <AccessSnapshotPanel
      access={phase.access}
      onSignOut={() => void signOut()}
    />
  ) : (
    <AccessCredentialsForm
      busy={phase.kind === 'busy'}
      error={phase.kind === 'signed-out' ? phase.error : undefined}
      onSubmit={(flow, email, password) =>
        void authenticate(flow, email, password)
      }
    />
  );
};
