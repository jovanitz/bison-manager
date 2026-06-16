import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useUseCases } from '../di/use-cases-context';
import { ClientLoginScreen } from './client-login-screen';

/**
 * Client session gate. Resolves the session + access snapshot and re-resolves
 * on every auth change. Anonymous → login; authenticated but ORG-LESS → create
 * your first organization; soft-blocked → notice; otherwise → the app.
 */
type GateState =
  | 'loading'
  | 'anonymous'
  | 'no-org'
  | 'blocked'
  | 'authenticated';

/** Org-less identity: create your own organization (you become its admin). */
const CreateOrgForm = ({ onCreated }: { readonly onCreated: () => void }) => {
  const { orgs } = useUseCases();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  if (!orgs) return <p>Org use cases are not wired in this app yet.</p>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    const result = await orgs.createOrganization(name);
    if (result.ok) onCreated();
    else setError(result.error.message);
  };

  return (
    <form aria-label="create organization" onSubmit={(e) => void submit(e)}>
      <h1>Create your organization</h1>
      <p>You don’t belong to an organization yet. Create one to get started.</p>
      <label>
        Organization name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <button type="submit">Create organization</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
};

export const RequireSession = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const { access } = useUseCases();
  const [state, setState] = useState<GateState>('loading');

  const resolve = useCallback(async () => {
    if (!access) return;
    const session = await access.getSession();
    if (!session.ok) return setState('anonymous');
    const snapshot = await access.currentAccess();
    // Valid Supabase session but no actor ⇒ authenticated yet org-less.
    if (!snapshot.ok) return setState('no-org');
    setState(snapshot.value.blocked ? 'blocked' : 'authenticated');
  }, [access]);

  useEffect(() => {
    if (!access) return;
    void resolve();
    const unsubscribe = access.onAuthChange(() => void resolve());
    return unsubscribe;
  }, [access, resolve]);

  if (!access) return <p>Access use cases are not wired in this app yet.</p>;
  if (state === 'loading') return <p>Loading…</p>;
  if (state === 'authenticated') return <>{children}</>;
  if (state === 'no-org') return <CreateOrgForm onCreated={() => void resolve()} />;
  if (state === 'blocked') {
    return (
      <section aria-label="blocked">
        <h1>Access blocked</h1>
        <p role="alert">
          Your access is blocked — you can sign in, but operations are
          unavailable. Please contact support.
        </p>
        <button type="button" onClick={() => void access.signOut()}>
          Sign out
        </button>
      </section>
    );
  }
  return <ClientLoginScreen />;
};
