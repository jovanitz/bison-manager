import { type FormEvent, useEffect, useState } from 'react';
import { useOrgRolesStore, useStore } from '../store/hooks';
import type { OrgRolesStore } from '../store/org-roles-store';

/** Create an org role: name + one own-scope permission. Pure dispatch. */
const CreateRoleForm = ({ store }: { readonly store: OrgRolesStore }) => {
  const [name, setName] = useState('');
  const [action, setAction] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void store.getState().createRole({ name, action, scope: 'own' });
    setName('');
    setAction('');
  };

  return (
    <form aria-label="create org role" onSubmit={submit}>
      <input
        aria-label="org role name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Role name"
      />
      <input
        aria-label="org role action"
        value={action}
        onChange={(event) => setAction(event.target.value)}
        placeholder="action e.g. members.read"
      />
      <button type="submit">Create role</button>
    </form>
  );
};

const OrgRolesView = ({ store }: { readonly store: OrgRolesStore }) => {
  const vm = useStore(store, (s) => s.vm);
  const notice = useStore(store, (s) => s.notice);

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  if (!vm || vm.hidden) return null;

  return (
    <section aria-label="manage org roles">
      <h2>Roles ({vm.roles.length})</h2>
      <p>Permission bundles you assign to members of your organization.</p>
      {notice ? <p role="status">{notice}</p> : null}
      <CreateRoleForm store={store} />
      <table aria-label="org roles">
        <thead>
          <tr>
            <th>Name</th>
            <th>Permissions</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {vm.roles.map((role) => (
            <tr key={role.id}>
              <td>
                {role.name}
                {role.templateKey !== null ? (
                  <span aria-label="default role"> (default)</span>
                ) : null}
              </td>
              <td>
                {role.permissions
                  .map((p) => `${p.action}:${p.scope}`)
                  .join(', ') || '—'}
              </td>
              <td>
                {role.templateKey !== null ? (
                  <button
                    type="button"
                    onClick={() => void store.getState().resetRole(role.id)}
                  >
                    Reset
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void store.getState().deleteRole(role.id)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const ManageRolesSection = () => {
  const store = useOrgRolesStore();
  if (!store) return null;
  return <OrgRolesView store={store} />;
};
