import { useEffect } from 'react';
import type {
  CustomerAccountSummary,
  StaffAccountSummary,
} from '@acme/application';
import { useDashboardStore, useStore } from './store/hooks';
import type { DashboardStore } from './store/dashboard-store';
import { InviteMemberForm } from './invitations/invite-member-form';
import { ManagePermissionsForm } from './permissions/manage-permissions-form';
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
