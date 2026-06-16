import { useState, type FormEvent } from 'react';
import {
  ACCESS_DELEGABLE_ACTION_CATALOG,
  type MemberSummaryDto,
} from '@acme/application';

const permKey = (p: { action: string; scope: string }) =>
  `${p.action}:${p.scope}`;

/** Picker limited to the delegable actions, always at `own` scope. */
const DelegablePicker = ({
  onAdd,
}: {
  readonly onAdd: (action: string) => void;
}) => {
  const [action, setAction] = useState(
    ACCESS_DELEGABLE_ACTION_CATALOG[0] ?? '',
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAdd(action);
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
          {ACCESS_DELEGABLE_ACTION_CATALOG.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Add permission (own)</button>
    </form>
  );
};

type RowCaps = {
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly canBlock: boolean;
};

type RowHandlers = {
  readonly onAdd: (membershipId: string, action: string) => void;
  readonly onRemove: (membershipId: string) => void;
  readonly onBlock: (membershipId: string, blocked: boolean) => void;
};

const MemberRow = ({
  member,
  caps,
  handlers,
}: {
  readonly member: MemberSummaryDto;
  readonly caps: RowCaps;
  readonly handlers: RowHandlers;
}) => (
  <li>
    <strong>{member.userId}</strong>
    {member.blocked ? <span role="status"> — blocked</span> : null}
    <ul aria-label={`permissions of ${member.userId}`}>
      {member.permissions.map((p) => (
        <li key={permKey(p)}>{permKey(p)}</li>
      ))}
    </ul>
    {member.isRoot ? (
      <p role="note">Protected account — cannot be changed.</p>
    ) : (
      <>
        {caps.canEdit ? (
          <DelegablePicker
            onAdd={(action) => handlers.onAdd(member.membershipId, action)}
          />
        ) : null}
        {caps.canBlock ? (
          <button
            type="button"
            onClick={() =>
              handlers.onBlock(member.membershipId, !member.blocked)
            }
          >
            {member.blocked ? 'Unblock' : 'Block'} {member.userId}
          </button>
        ) : null}
        {caps.canRemove ? (
          <button
            type="button"
            onClick={() => handlers.onRemove(member.membershipId)}
          >
            Remove {member.userId}
          </button>
        ) : null}
      </>
    )}
  </li>
);

export const MemberList = ({
  members,
  caps,
  handlers,
  notice,
}: {
  readonly members: ReadonlyArray<MemberSummaryDto>;
  readonly caps: RowCaps;
  readonly handlers: RowHandlers;
  readonly notice: string | undefined;
}) => (
  <section aria-label="org members">
    <h3>Members ({members.length})</h3>
    <ul>
      {members.map((m) => (
        <MemberRow
          key={m.membershipId}
          member={m}
          caps={caps}
          handlers={handlers}
        />
      ))}
    </ul>
    {notice ? <p role="alert">{notice}</p> : null}
  </section>
);
