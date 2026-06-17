import { useState, type FormEvent } from 'react';

/**
 * Presentational invite form. It holds NO flow logic: it collects an email,
 * calls `onInvite`, and renders the one-time activation link the store surfaces
 * (the default grant and the invitation itself are decided in the controller).
 */
export const InviteMember = ({
  token,
  onInvite,
}: {
  readonly token: string | null;
  readonly onInvite: (email: string) => void;
}) => {
  const [email, setEmail] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onInvite(email);
    setEmail('');
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
