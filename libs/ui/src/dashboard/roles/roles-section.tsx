import { type FormEvent, useEffect, useState } from 'react';
import { useRolesStore, useStore } from '../store/hooks';
import type { RolesStore } from '../store/roles-store';

/** Create-role form: name + one permission pair. Pure dispatch, no logic. */
const CreateRoleForm = ({ store }: { readonly store: RolesStore }) => {
  const [name, setName] = useState('');
  const [action, setAction] = useState('');
  const [scope, setScope] = useState('any');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void store.getState().createRole({ name, action, scope });
    setName('');
    setAction('');
  };

  return (
    <form aria-label="create role" onSubmit={submit}>
      <input
        aria-label="role name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Role name"
      />
      <input
        aria-label="permission action"
        value={action}
        onChange={(event) => setAction(event.target.value)}
        placeholder="action e.g. staff.read"
      />
      <select
        aria-label="permission scope"
        value={scope}
        onChange={(event) => setScope(event.target.value)}
      >
        <option value="any">any</option>
        <option value="own">own</option>
      </select>
      <button type="submit">Create role</button>
    </form>
  );
};

const RolesView = ({ store }: { readonly store: RolesStore }) => {
  const vm = useStore(store, (s) => s.vm);
  const notice = useStore(store, (s) => s.notice);
  const canManage = vm?.canManage ?? false;

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  return (
    <section aria-label="roles section">
      <h2>Roles ({vm ? vm.roles.length : 0})</h2>
      <p>Named permission bundles assigned to memberships.</p>
      {notice ? <p role="status">{notice}</p> : null}
      {canManage ? <CreateRoleForm store={store} /> : null}
      <table aria-label="roles">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scope</th>
            <th>Permissions</th>
            {canManage ? <th>Manage</th> : null}
          </tr>
        </thead>
        <tbody>
          {(vm?.roles ?? []).map((role) => (
            <tr key={role.id}>
              <td>
                {role.name}
                {role.templateKey !== null ? (
                  <span aria-label="default role"> (default)</span>
                ) : null}
              </td>
              <td>{role.accountId === null ? 'platform' : role.accountId}</td>
              <td>
                {role.permissions
                  .map((p) => `${p.action}:${p.scope}`)
                  .join(', ') || '—'}
              </td>
              {canManage ? (
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
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const RolesSection = () => {
  const store = useRolesStore();
  if (!store) return null;
  return <RolesView store={store} />;
};
