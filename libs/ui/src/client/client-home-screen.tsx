import { useEffect } from 'react';
import type { MyMembershipDto } from '@acme/application';
import { useSessionStore, useStore } from './store/hooks';
import type { SessionStore } from './store/session-store';
import { ManageOrgSection } from './manage-org/manage-org-section';

const OrgSwitcher = ({
  orgs,
  currentAccountId,
  onSwitch,
}: {
  readonly orgs: ReadonlyArray<MyMembershipDto>;
  readonly currentAccountId: string;
  readonly onSwitch: (membershipId: string) => void;
}) => {
  if (orgs.length === 0) return null;
  return (
    <section aria-label="my orgs">
      <h2>Your organizations ({orgs.length})</h2>
      <ul>
        {orgs.map((o) => (
          <li key={o.membershipId}>
            {o.accountName ?? o.accountId} ({o.accountKind})
            {o.accountId === currentAccountId ? (
              <strong> — current</strong>
            ) : (
              <button type="button" onClick={() => onSwitch(o.membershipId)}>
                Switch
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Pure presentation: reads the home ViewModel from the session store. */
const HomeView = ({ store }: { readonly store: SessionStore }) => {
  const home = useStore(store, (s) => s.home);
  const error = useStore(store, (s) => s.error);

  useEffect(() => {
    void store.getState().loadHome();
  }, [store]);

  return (
    <main aria-label="client home">
      <header>
        <h1>My account</h1>
        <button type="button" onClick={() => void store.getState().signOut()}>
          Sign out
        </button>
      </header>
      {!home && !error ? <p>Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {home ? (
        <>
          <p data-testid="current-org">Current org: {home.access.accountId}</p>
          <ul aria-label="my permissions">
            {home.access.permissions.map((p) => (
              <li key={`${p.action}:${p.scope}`}>
                {p.action} ({p.scope})
              </li>
            ))}
          </ul>
          <OrgSwitcher
            orgs={home.orgs}
            currentAccountId={home.access.accountId}
            onSwitch={(id) => void store.getState().switchTo(id)}
          />
          <ManageOrgSection />
        </>
      ) : null}
    </main>
  );
};

export const ClientHomeScreen = () => {
  const store = useSessionStore();
  if (!store) return <p>Access use cases are not wired in this app yet.</p>;
  return <HomeView store={store} />;
};
