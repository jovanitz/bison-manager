import { useEffect, useState, type FormEvent } from 'react';
import type { CurrentAccessDto } from '@acme/application';
import { useUseCases } from '../../di/use-cases-context';
import { holdsAction } from '../admin-access';

/**
 * Admin control to invite a new staff member. It issues an invitation into the
 * admin's OWN account with dashboard-visibility permission (`staff.read`), then
 * shows the one-time activation link to copy and hand to the invitee. The token
 * is shown exactly once (the server only stores its hash).
 *
 * Deliberately unstyled and minimal: no permission editor — a fixed staff-read
 * grant is enough to prove the invite → activate → login loop.
 */
const STAFF_DASHBOARD_GRANT = [
  { action: 'staff.read', scope: 'any' },
  { action: 'customer.search', scope: 'any' },
];

type InvitePhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'invited'; readonly link: string };

export const InviteMemberForm = () => {
  const { access, invitations } = useUseCases();
  const [snapshot, setSnapshot] = useState<CurrentAccessDto | null>(null);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<InvitePhase>({ kind: 'idle' });

  useEffect(() => {
    if (!access) return;
    let live = true;
    void access.currentAccess().then((r) => {
      if (live && r.ok) setSnapshot(r.value);
    });
    return () => {
      live = false;
    };
  }, [access]);

  // Hide entirely unless the actor can actually invite (server still enforces).
  if (!access || !invitations) return null;
  if (!snapshot || !holdsAction(snapshot, 'members.invite')) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPhase({ kind: 'busy' });
    const result = await invitations.invite({
      accountId: snapshot.accountId,
      email,
      permissions: STAFF_DASHBOARD_GRANT,
    });
    if (!result.ok) {
      setPhase({ kind: 'error', message: result.error.message });
      return;
    }
    const link = `${window.location.origin}/activate#token=${result.value.token}`;
    setPhase({ kind: 'invited', link });
    setEmail('');
  };

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
        <button type="submit" disabled={phase.kind === 'busy'}>
          Send invitation
        </button>
      </form>
      {phase.kind === 'error' ? <p role="alert">{phase.message}</p> : null}
      {phase.kind === 'invited' ? (
        <p>
          Activation link (copy &amp; share):{' '}
          <code data-testid="activation-link">{phase.link}</code>
        </p>
      ) : null}
    </section>
  );
};
