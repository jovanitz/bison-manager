import { useEffect, useState, type FormEvent } from 'react';
import { useStaffInviteStore, useStore } from '../store/hooks';
import type { StaffInviteStore } from '../store/staff-invite-store';

/**
 * Admin control to invite a staff member into the admin's own account. Pure
 * presentation: gating (canInvite), the fixed staff grant, resolving the
 * account and issuing the invitation all live in the headless controller; this
 * collects an email, dispatches, and renders the one-time activation link.
 */
const InviteForm = ({ store }: { readonly store: StaffInviteStore }) => {
  const [email, setEmail] = useState('');
  const canInvite = useStore(store, (s) => s.canInvite);
  const token = useStore(store, (s) => s.token);
  const error = useStore(store, (s) => s.error);
  const busy = useStore(store, (s) => s.busy);

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  if (!canInvite) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await store.getState().invite(email);
    setEmail('');
  };
  const link = token
    ? `${window.location.origin}/activate#token=${token}`
    : null;

  return (
    <section aria-label="invite member">
      <h2>Invite staff</h2>
      <form aria-label="invite" onSubmit={(e) => void submit(e)}>
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
        <button type="submit" disabled={busy}>
          Send invitation
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {link ? (
        <p>
          Activation link (copy &amp; share):{' '}
          <code data-testid="activation-link">{link}</code>
        </p>
      ) : null}
    </section>
  );
};

export const InviteMemberForm = () => {
  const store = useStaffInviteStore();
  if (!store) return null;
  return <InviteForm store={store} />;
};
