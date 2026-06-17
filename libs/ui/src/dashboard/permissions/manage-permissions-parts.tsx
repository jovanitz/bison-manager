import { useState, type FormEvent } from 'react';
import {
  ACCESS_ACTION_CATALOG,
  ACCESS_SCOPE_CATALOG,
  type MemberSummaryDto,
} from '@acme/application';
import { BlockButtons } from '../block/block-buttons';

const permKey = (p: { action: string; scope: string }) =>
  `${p.action}:${p.scope}`;

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
  notice,
  canEdit,
  canBlock,
  onAdd,
  onBlock,
}: {
  readonly member: MemberSummaryDto;
  readonly notice: string | undefined;
  readonly canEdit: boolean;
  readonly canBlock: boolean;
  readonly onAdd: (action: string, scope: string) => void;
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
