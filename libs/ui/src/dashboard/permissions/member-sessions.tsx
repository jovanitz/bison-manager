import { useEffect } from 'react';
import type { AdminSessionDto } from '@acme/application';

/**
 * The selected member's active sessions, with per-session and bulk revoke. Pure
 * presentation: loads on mount/member-change and dispatches revoke actions.
 */
export const MemberSessions = ({
  membershipId,
  sessions,
  onLoad,
  onRevoke,
  onRevokeAll,
}: {
  readonly membershipId: string;
  readonly sessions: ReadonlyArray<AdminSessionDto>;
  readonly onLoad: () => void;
  readonly onRevoke: (sessionId: string) => void;
  readonly onRevokeAll: () => void;
}) => {
  useEffect(() => {
    onLoad();
  }, [membershipId, onLoad]);

  return (
    <section aria-label="member sessions">
      <h3>Active sessions ({sessions.length})</h3>
      <button type="button" onClick={() => onRevokeAll()}>
        Revoke all sessions
      </button>
      <ul aria-label="sessions">
        {sessions.map((session) => (
          <li key={session.id}>
            {session.status} · {session.userAgent ?? 'unknown device'} ·{' '}
            {session.lastIp ?? 'no ip'} · expires {session.expiresAt}
            <button type="button" onClick={() => onRevoke(session.id)}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
