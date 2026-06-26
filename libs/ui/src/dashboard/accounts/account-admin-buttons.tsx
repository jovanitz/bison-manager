import { useState } from 'react';

/**
 * Presentational account-lifecycle controls (ADR-0010). No flow logic: it calls
 * `onAdmin(action)` (wired to a store action) and shows the notice it returns.
 * The server enforces validity (e.g. enabling an active account is refused).
 */
export const AccountAdminButtons = ({
  label,
  onAdmin,
}: {
  readonly label: string;
  readonly onAdmin: (
    action: 'disable' | 'enable' | 'promote',
  ) => Promise<string>;
}) => {
  const [notice, setNotice] = useState<string | undefined>();
  const run = async (action: 'disable' | 'enable' | 'promote') => {
    setNotice(undefined);
    setNotice(await onAdmin(action));
  };
  return (
    <span aria-label={label}>
      <button type="button" onClick={() => void run('disable')}>
        Disable
      </button>
      <button type="button" onClick={() => void run('enable')}>
        Enable
      </button>
      <button type="button" onClick={() => void run('promote')}>
        Promote
      </button>
      {notice ? <small role="status"> {notice}</small> : null}
    </span>
  );
};
