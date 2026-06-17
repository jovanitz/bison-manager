import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ClientLoginScreen } from './client-login-screen';
import { useSessionStore, useStore } from './store/hooks';
import type { SessionStore } from './store/session-store';

/**
 * Client session gate. All decisions live in the headless `resolveClientGate`
 * controller (driven through the session store); this component is only the
 * reactive shell — it subscribes to auth changes and renders one view per state.
 */
const CreateOrgForm = ({ store }: { readonly store: SessionStore }) => {
  const [name, setName] = useState('');
  const error = useStore(store, (s) => s.createError);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void store.getState().create(name);
  };
  return (
    <form aria-label="create organization" onSubmit={submit}>
      <h1>Create your organization</h1>
      <p>You don’t belong to an organization yet. Create one to get started.</p>
      <label>
        Organization name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <button type="submit">Create organization</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
};

const SessionGate = ({
  store,
  children,
}: {
  readonly store: SessionStore;
  readonly children: ReactNode;
}) => {
  const gate = useStore(store, (s) => s.gate);

  useEffect(() => {
    const s = store.getState();
    void s.resolveGate();
    return s.subscribe();
  }, [store]);

  if (gate === 'loading') return <p>Loading…</p>;
  if (gate === 'authenticated') return <>{children}</>;
  if (gate === 'no-org') return <CreateOrgForm store={store} />;
  if (gate === 'blocked') {
    return (
      <section aria-label="blocked">
        <h1>Access blocked</h1>
        <p role="alert">
          Your access is blocked — you can sign in, but operations are
          unavailable. Please contact support.
        </p>
        <button type="button" onClick={() => void store.getState().signOut()}>
          Sign out
        </button>
      </section>
    );
  }
  return <ClientLoginScreen />;
};

export const RequireSession = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const store = useSessionStore();
  if (!store) return <p>Access use cases are not wired in this app yet.</p>;
  return <SessionGate store={store}>{children}</SessionGate>;
};
