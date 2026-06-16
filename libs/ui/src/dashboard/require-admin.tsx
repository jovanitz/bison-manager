import { useEffect, useState, type ReactNode } from 'react';
import { useUseCases } from '../di/use-cases-context';
import { isPlatformAdmin } from './admin-access';
import { DashboardLoginScreen } from './login-screen';

/**
 * The dashboard's route guard. It resolves the current session + access
 * snapshot and re-resolves whenever auth changes (sign-in / sign-out), so the
 * app flips between the login form and the protected `children` purely from
 * auth state — no manual navigation. Anonymous → login; signed in without
 * platform access → login with a notice; authorized admin → `children`.
 */
type GateState =
  | 'loading'
  | 'anonymous'
  | 'forbidden'
  | 'blocked'
  | 'authorized';

export const RequireAdmin = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const { access } = useUseCases();
  const [state, setState] = useState<GateState>('loading');

  useEffect(() => {
    if (!access) return;
    let live = true;

    const resolve = async () => {
      const session = await access.getSession();
      if (!live) return;
      if (!session.ok) {
        setState('anonymous');
        return;
      }
      const snapshot = await access.currentAccess();
      if (!live) return;
      if (!snapshot.ok) {
        setState('anonymous');
        return;
      }
      if (snapshot.value.blocked) {
        setState('blocked');
        return;
      }
      setState(isPlatformAdmin(snapshot.value) ? 'authorized' : 'forbidden');
    };

    void resolve();
    // Re-resolve on every auth transition (login, logout, token refresh).
    const unsubscribe = access.onAuthChange(() => void resolve());
    return () => {
      live = false;
      unsubscribe();
    };
  }, [access]);

  if (!access) {
    return <p>Access use cases are not wired in this app yet.</p>;
  }
  if (state === 'loading') return <p>Loading…</p>;
  if (state === 'blocked') {
    return (
      <section aria-label="blocked">
        <h1>Access blocked</h1>
        <p role="alert">
          Your access is blocked. You can sign in, but operations are
          unavailable — please contact the platform team.
        </p>
        <button type="button" onClick={() => void access.signOut()}>
          Sign out
        </button>
      </section>
    );
  }
  if (state === 'authorized') return <>{children}</>;
  if (state === 'forbidden') {
    return (
      <DashboardLoginScreen notice="This account has no staff access to the dashboard." />
    );
  }
  return <DashboardLoginScreen />;
};
