import { useState } from 'react';
import type { PendingInvitationSummary } from '@acme/application';

const PendingRow = ({
  row,
  onRegenerate,
}: {
  readonly row: PendingInvitationSummary;
  readonly onRegenerate: (id: string) => Promise<string>;
}) => {
  const [link, setLink] = useState<string | null>(null);
  return (
    <tr>
      <td>{row.email}</td>
      <td>{row.expiresAt}</td>
      <td>
        <button
          type="button"
          onClick={async () => setLink(await onRegenerate(row.invitationId))}
        >
          Regenerate link
        </button>
        {link ? <code data-testid="invite-link">{link}</code> : null}
      </td>
    </tr>
  );
};

/**
 * Pending (sent, not-yet-activated) invitations. Never shows a stored token —
 * the plaintext is only known at creation; "Regenerate link" rotates the token
 * and reveals the fresh one once.
 */
export const PendingInvitationsTable = ({
  rows,
  onRegenerate,
}: {
  readonly rows: ReadonlyArray<PendingInvitationSummary>;
  readonly onRegenerate: (id: string) => Promise<string>;
}) => (
  <table aria-label="pending invitations">
    <thead>
      <tr>
        <th>Email</th>
        <th>Expires</th>
        <th>Link</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <PendingRow
          key={row.invitationId}
          row={row}
          onRegenerate={onRegenerate}
        />
      ))}
    </tbody>
  </table>
);
