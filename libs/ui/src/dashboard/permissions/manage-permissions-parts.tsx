import { useState, type FormEvent } from 'react';
import {
  ACCESS_ACTION_CATALOG,
  ACCESS_SCOPE_CATALOG,
  type MemberSummaryDto,
  type RoleSummaryDto,
} from '@acme/application';
import { BlockButtons } from '../block/block-buttons';

const permKey = (p: { action: string; scope: string }) =>
  `${p.action}:${p.scope}`;

/** Checklist of the account's roles; submits the chosen set as a replace. */
const RolePicker = ({
  availableRoles,
  current,
  onAssign,
}: {
  readonly availableRoles: ReadonlyArray<RoleSummaryDto>;
  readonly current: ReadonlyArray<string>;
  readonly onAssign: (roleIds: ReadonlyArray<string>) => void;
}) => {
  const [selected, setSelected] = useState<ReadonlyArray<string>>(current);
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAssign(selected);
  };
  if (availableRoles.length === 0) return <p>No roles defined yet.</p>;
  return (
    <form aria-label="assign roles" onSubmit={submit}>
      {availableRoles.map((role) => (
        <label key={role.id}>
          <input
            type="checkbox"
            aria-label={`role ${role.name}`}
            checked={selected.includes(role.id)}
            onChange={() => toggle(role.id)}
          />
          {role.name}
        </label>
      ))}
      <button type="submit">Set roles</button>
    </form>
  );
};

const PermissionPicker = ({
  onAdd,
}: {
  readonly onAdd: (action: string, scope: string) => void;
}) => {
  const [action, setAction] = useState(ACCESS_ACTION_CATALOG[0] ?? '');
  const [scope, setScope] = useState('own');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAdd(action, scope);
  };
  return (
    <form aria-label="add permission" onSubmit={submit}>
      <label>
        Action
        <select
          aria-label="action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          {ACCESS_ACTION_CATALOG.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label>
        Scope
        <select
          aria-label="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          {ACCESS_SCOPE_CATALOG.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Add permission</button>
    </form>
  );
};

export const MemberDetail = ({
  member,
  availableRoles,
  notice,
  canEdit,
  canBlock,
  onAdd,
  onAssignRoles,
  onBlock,
}: {
  readonly member: MemberSummaryDto;
  readonly availableRoles: ReadonlyArray<RoleSummaryDto>;
  readonly notice: string | undefined;
  readonly canEdit: boolean;
  readonly canBlock: boolean;
  readonly onAdd: (action: string, scope: string) => void;
  readonly onAssignRoles: (roleIds: ReadonlyArray<string>) => void;
  readonly onBlock: (blocked: boolean) => Promise<string>;
}) => (
  <div>
    <p>Current permissions:</p>
    <ul aria-label="current permissions">
      {member.permissions.map((p) => (
        <li key={permKey(p)}>{permKey(p)}</li>
      ))}
    </ul>
    {member.isRoot ? (
      <p role="note">
        This is the protected super-admin — its permissions cannot be changed.
      </p>
    ) : (
      <>
        {canEdit ? <PermissionPicker onAdd={onAdd} /> : null}
        {canEdit ? (
          <>
            <p>Roles:</p>
            <RolePicker
              key={member.membershipId}
              availableRoles={availableRoles}
              current={member.roleIds}
              onAssign={onAssignRoles}
            />
          </>
        ) : null}
        {canBlock ? (
          <p>
            Identity access:{' '}
            <BlockButtons label="block identity" onBlock={onBlock} />
          </p>
        ) : null}
      </>
    )}
    {notice ? <p role="alert">{notice}</p> : null}
  </div>
);

export const MemberSelect = ({
  members,
  value,
  onChange,
}: {
  readonly members: ReadonlyArray<MemberSummaryDto>;
  readonly value: string;
  readonly onChange: (id: string) => void;
}) => (
  <label>
    Member
    <select
      aria-label="member"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— select —</option>
      {members.map((m) => (
        <option key={m.membershipId} value={m.membershipId}>
          {m.userId}
          {m.isRoot ? ' (super-admin)' : ''}
        </option>
      ))}
    </select>
  </label>
);
