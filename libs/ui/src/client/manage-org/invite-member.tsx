import { useState, type FormEvent } from 'react';
import type { RoleSummaryDto } from '@acme/application';

/**
 * Presentational invite form. It holds NO flow logic: it collects an email and
 * an optional set of roles, calls `onInvite`, and renders the one-time
 * activation link the store surfaces (the default grant and the invitation
 * itself are decided in the controller).
 */
export const InviteMember = ({
  token,
  roles,
  onInvite,
}: {
  readonly token: string | null;
  readonly roles: ReadonlyArray<RoleSummaryDto>;
  readonly onInvite: (email: string, roleIds: ReadonlyArray<string>) => void;
}) => {
  const [email, setEmail] = useState('');
  const [roleIds, setRoleIds] = useState<ReadonlyArray<string>>([]);
  const toggle = (id: string) =>
    setRoleIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onInvite(email, roleIds);
    setEmail('');
    setRoleIds([]);
  };
  const link = token
    ? `${window.location.origin}/activate#token=${token}`
    : null;

  return (
    <section aria-label="invite member">
      <h3>Invite a member</h3>
      <form aria-label="invite" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {roles.length > 0 ? (
          <fieldset aria-label="invite roles">
            <legend>Roles</legend>
            {roles.map((role) => (
              <label key={role.id}>
                <input
                  type="checkbox"
                  aria-label={`invite role ${role.name}`}
                  checked={roleIds.includes(role.id)}
                  onChange={() => toggle(role.id)}
                />
                {role.name}
              </label>
            ))}
          </fieldset>
        ) : null}
        <button type="submit">Send invitation</button>
      </form>
      {link ? (
        <p>
          Activation link (copy &amp; share):{' '}
          <code data-testid="activation-link">{link}</code>
        </p>
      ) : null}
    </section>
  );
};
