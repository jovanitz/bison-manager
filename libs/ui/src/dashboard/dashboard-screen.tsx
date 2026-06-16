import { useEffect, useState } from 'react';
import type {
  CustomerAccountSummary,
  StaffAccountSummary,
} from '@acme/application';
import { useUseCases } from '../di/use-cases-context';
import { holdsAction } from './admin-access';
import { InviteMemberForm } from './invitations/invite-member-form';
import { ManagePermissionsForm } from './permissions/manage-permissions-form';
import { BlockButtons } from './block/block-buttons';

/**
 * The staff dashboard, deliberately unstyled (native HTML): two tables — staff
 * and customers — plus sign-out. It reads the directory through the `directory`
 * use cases; both reads are reauthorized server-side. Rendered only once
 * `RequireAdmin` has confirmed an authorized platform admin.
 */
type DashboardData = {
  readonly staff: ReadonlyArray<StaffAccountSummary>;
  readonly customers: ReadonlyArray<CustomerAccountSummary>;
  readonly canBlock: boolean;
};

type DashboardState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly data: DashboardData };

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
}: {
  readonly rows: ReadonlyArray<CustomerAccountSummary>;
  readonly canBlock: boolean;
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
              <BlockButtons subject="org" id={row.accountId} />
            </td>
          ) : null}
        </tr>
      ))}
    </tbody>
  </table>
);

const useDashboardData = (): DashboardState => {
  const { access, directory } = useUseCases();
  const [state, setState] = useState<DashboardState>({ kind: 'loading' });

  useEffect(() => {
    if (!directory) {
      setState({
        kind: 'error',
        message: 'Directory use cases are not wired.',
      });
      return;
    }
    let live = true;
    void (async () => {
      const [staff, customers, snapshot] = await Promise.all([
        directory.listStaff(),
        directory.listCustomers(),
        access?.currentAccess(),
      ]);
      if (!live) return;
      if (!staff.ok)
        return setState({ kind: 'error', message: staff.error.message });
      if (!customers.ok)
        return setState({ kind: 'error', message: customers.error.message });
      setState({
        kind: 'ready',
        data: {
          staff: staff.value,
          customers: customers.value,
          canBlock:
            snapshot?.ok === true &&
            holdsAction(snapshot.value, 'access.block'),
        },
      });
    })();
    return () => {
      live = false;
    };
  }, [directory, access]);

  return state;
};

export const DashboardScreen = () => {
  const { access } = useUseCases();
  const state = useDashboardData();

  return (
    <main aria-label="dashboard">
      <header>
        <h1>Staff dashboard</h1>
        <button type="button" onClick={() => void access?.signOut()}>
          Sign out
        </button>
      </header>

      <InviteMemberForm />
      <ManagePermissionsForm />

      {state.kind === 'loading' ? <p>Loading…</p> : null}
      {state.kind === 'error' ? <p role="alert">{state.message}</p> : null}
      {state.kind === 'ready' ? (
        <>
          <section aria-label="staff section">
            <h2>Staff ({state.data.staff.length})</h2>
            <StaffTable rows={state.data.staff} />
          </section>
          <section aria-label="customers section">
            <h2>Customers ({state.data.customers.length})</h2>
            <CustomersTable
              rows={state.data.customers}
              canBlock={state.data.canBlock}
            />
          </section>
        </>
      ) : null}
    </main>
  );
};
