import { useCallback, useEffect, useState } from 'react';
import type { CurrentAccessDto, MyMembershipDto } from '@acme/application';
import { useUseCases } from '../di/use-cases-context';
import { ManageOrgSection } from './manage-org/manage-org-section';

type HomeState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready';
      readonly access: CurrentAccessDto;
      readonly orgs: ReadonlyArray<MyMembershipDto>;
    };

/** Loads the current access snapshot + the caller's organizations together. */
const useHomeData = () => {
  const { access, orgs } = useUseCases();
  const [state, setState] = useState<HomeState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!access) return;
    const [snapshot, mine] = await Promise.all([
      access.currentAccess(),
      orgs?.listMyMemberships(),
    ]);
    if (!snapshot.ok) {
      setState({ kind: 'error', message: snapshot.error.message });
      return;
    }
    setState({
      kind: 'ready',
      access: snapshot.value,
      orgs: mine?.ok ? mine.value : [],
    });
  }, [access, orgs]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
};

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

export const ClientHomeScreen = () => {
  const { access, orgs } = useUseCases();
  const { state, reload } = useHomeData();

  const onSwitch = async (membershipId: string) => {
    const result = await orgs?.switchAccount(membershipId);
    if (result?.ok) await reload();
  };

  return (
    <main aria-label="client home">
      <header>
        <h1>My account</h1>
        <button type="button" onClick={() => void access?.signOut()}>
          Sign out
        </button>
      </header>
      {state.kind === 'loading' ? <p>Loading…</p> : null}
      {state.kind === 'error' ? <p role="alert">{state.message}</p> : null}
      {state.kind === 'ready' ? (
        <>
          <p data-testid="current-org">Current org: {state.access.accountId}</p>
          <ul aria-label="my permissions">
            {state.access.permissions.map((p) => (
              <li key={`${p.action}:${p.scope}`}>
                {p.action} ({p.scope})
              </li>
            ))}
          </ul>
          <OrgSwitcher
            orgs={state.orgs}
            currentAccountId={state.access.accountId}
            onSwitch={(id) => void onSwitch(id)}
          />
          <ManageOrgSection />
        </>
      ) : null}
    </main>
  );
};
