import { useState, type FormEvent } from 'react';
import { useUseCases } from '../../di/use-cases-context';

/**
 * Invite an email into the org admin's OWN organization. The new member lands
 * with a minimal own-scope grant (they can read the org); the admin refines
 * permissions afterwards from the member list. The one-time activation link is
 * shown exactly once — the server only stores its hash.
 */
const DEFAULT_MEMBER_GRANT = [{ action: 'customer.read', scope: 'own' }];

type InvitePhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'invited'; readonly link: string };

export const InviteMember = ({
  accountId,
  onInvited,
}: {
  readonly accountId: string;
  readonly onInvited: () => void;
}) => {
  const { invitations } = useUseCases();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<InvitePhase>({ kind: 'idle' });
  if (!invitations) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPhase({ kind: 'busy' });
    const result = await invitations.invite({
      accountId,
      email,
      permissions: DEFAULT_MEMBER_GRANT,
    });
    if (!result.ok) {
      setPhase({ kind: 'error', message: result.error.message });
      return;
    }
    const link = `${window.location.origin}/activate#token=${result.value.token}`;
    setPhase({ kind: 'invited', link });
    setEmail('');
    onInvited();
  };

  return (
    <section aria-label="invite member">
      <h3>Invite a member</h3>
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
