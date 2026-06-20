import { useEffect } from 'react';
import type {
  CustomerAccountSummary,
  OrphanIdentitySummary,
  StaffAccountSummary,
} from '@acme/application';
import { useDashboardStore, useStore } from './store/hooks';
import type { DashboardStore } from './store/dashboard-store';
import { InviteMemberForm } from './invitations/invite-member-form';
import { PendingInvitationsTable } from './invitations/pending-invitations-table';
import { ManagePermissionsForm } from './permissions/manage-permissions-form';
import { RolesSection } from './roles/roles-section';
import { BlockButtons } from './block/block-buttons';

/**
 * The staff dashboard. Pure presentation: it reads the ViewModel (staff +
 * customers + canBlock) from the dashboard store and dispatches the org
 * soft-block action. Composition + capability derivation live in the controller.
 */
const StaffTable = ({
  rows,
}: {
  readonly rows: ReadonlyArray<StaffAccountSummary>;
}) => (
  <table aria-label="staff">
    <thead>
      <tr>
        <th>Email</th>
        <th>Name</th>
        <th>Account</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.accountId}>
          <td>{row.email ?? '—'}</td>
          <td>{row.displayName ?? '—'}</td>
          <td>{row.accountId}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const CustomersTable = ({
  rows,
  canBlock,
  onBlock,
}: {
  readonly rows: ReadonlyArray<CustomerAccountSummary>;
  readonly canBlock: boolean;
  readonly onBlock: (id: string, blocked: boolean) => Promise<string>;
}) => (
  <table aria-label="customers">
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Account</th>
        {canBlock ? <th>Access</th> : null}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.accountId}>
          <td>{row.displayName}</td>
          <td>{row.email ?? '—'}</td>
          <td>{row.accountId}</td>
          {canBlock ? (
            <td>
              <BlockButtons
                label="block org"
                onBlock={(blocked) => onBlock(row.accountId, blocked)}
              />
            </td>
          ) : null}
        </tr>
      ))}
    </tbody>
  </table>
);

const ZombiesTable = ({
  rows,
}: {
  readonly rows: ReadonlyArray<OrphanIdentitySummary>;
}) => (
  <table aria-label="zombies">
    <thead>
      <tr>
        <th>Email</th>
        <th>User</th>
        <th>Registered</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.userId}>
          <td>{row.email ?? '—'}</td>
          <td>{row.userId}</td>
          <td>{row.createdAt}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const DashboardView = ({ store }: { readonly store: DashboardStore }) => {
  const vm = useStore(store, (s) => s.vm);
  const error = useStore(store, (s) => s.error);

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  return (
    <main aria-label="dashboard">
      <header>
        <h1>Staff dashboard</h1>
        <button type="button" onClick={() => void store.getState().signOut()}>
          Sign out
        </button>
      </header>

      <InviteMemberForm />
      <ManagePermissionsForm />
      <RolesSection />

      {!vm && !error ? <p>Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {vm ? (
        <>
          <section aria-label="staff section">
            <h2>Staff ({vm.staff.length})</h2>
            <StaffTable rows={vm.staff} />
          </section>
          <section aria-label="customers section">
            <h2>Customers ({vm.customers.length})</h2>
            <CustomersTable
              rows={vm.customers}
              canBlock={vm.canBlock}
              onBlock={(id, blocked) =>
                store.getState().setOrgBlocked(id, blocked)
              }
            />
          </section>
          <section aria-label="pending invitations section">
            <h2>Pending invitations ({vm.pendingInvitations.length})</h2>
            <p>
              Sent but not yet activated. The original link is shown once at
              creation — use “Regenerate link” to issue a fresh one.
            </p>
            <PendingInvitationsTable
              rows={vm.pendingInvitations}
              onRegenerate={(id) => store.getState().regenerateLink(id)}
            />
          </section>
          <section aria-label="zombies section">
            <h2>Zombies ({vm.orphans.length})</h2>
            <p>
              Identities with no organization — sign-ups that never onboarded.
            </p>
            <ZombiesTable rows={vm.orphans} />
          </section>
        </>
      ) : null}
    </main>
  );
};

export const DashboardScreen = () => {
  const store = useDashboardStore();
  if (!store) return <p>Dashboard use cases are not wired.</p>;
  return <DashboardView store={store} />;
};
