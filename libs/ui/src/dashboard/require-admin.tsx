import { useEffect, type ReactNode } from 'react';
import { DashboardLoginScreen } from './login-screen';
import { useAdminGateStore, useStore } from './store/hooks';
import type { AdminGateStore } from './store/admin-gate-store';

/**
 * The dashboard route guard. The decision (anonymous / forbidden / blocked /
 * authorized) lives in the headless `resolveAdminGate` controller, driven via
 * the gate store; this is only the reactive shell that re-resolves on auth
 * changes and renders one view per state.
 */
const AdminGate = ({
  store,
  children,
}: {
  readonly store: AdminGateStore;
  readonly children: ReactNode;
}) => {
  const gate = useStore(store, (s) => s.gate);

  useEffect(() => {
    const s = store.getState();
    void s.resolve();
    return s.subscribe();
  }, [store]);

  if (gate === 'loading') return <p>Loading…</p>;
  if (gate === 'authorized') return <>{children}</>;
  if (gate === 'blocked') {
    return (
      <section aria-label="blocked">
        <h1>Access blocked</h1>
        <p role="alert">
          Your access is blocked. You can sign in, but operations are
          unavailable — please contact the platform team.
        </p>
        <button type="button" onClick={() => void store.getState().signOut()}>
          Sign out
        </button>
      </section>
    );
  }
  if (gate === 'forbidden') {
    return (
      <DashboardLoginScreen notice="This account has no staff access to the dashboard." />
    );
  }
  return <DashboardLoginScreen />;
};

export const RequireAdmin = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const store = useAdminGateStore();
  if (!store) return <p>Access use cases are not wired in this app yet.</p>;
  return <AdminGate store={store}>{children}</AdminGate>;
};
