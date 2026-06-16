import { useState } from 'react';
import { useUseCases } from '../../di/use-cases-context';

/**
 * Soft-block controls for one subject (an org account or a user identity).
 * Block = can still sign in, cannot operate. Unstyled and minimal: Block /
 * Unblock; the server enforces the permission and protects the super-admin.
 */
export const BlockButtons = ({
  subject,
  id,
}: {
  readonly subject: 'org' | 'identity';
  readonly id: string;
}) => {
  const { block } = useUseCases();
  const [notice, setNotice] = useState<string | undefined>();
  if (!block) return null;
  const api = block;

  const dispatch = (blocked: boolean) => {
    if (subject === 'org') {
      return blocked ? api.blockOrg(id) : api.unblockOrg(id);
    }
    return blocked ? api.blockIdentity(id) : api.unblockIdentity(id);
  };

  const run = async (blocked: boolean) => {
    setNotice(undefined);
    const result = await dispatch(blocked);
    if (!result.ok) {
      setNotice(result.error.message);
      return;
    }
    setNotice(blocked ? 'Blocked' : 'Unblocked');
  };

  return (
    <span aria-label={`block ${subject}`}>
      <button type="button" onClick={() => void run(true)}>
        Block
      </button>
      <button type="button" onClick={() => void run(false)}>
        Unblock
      </button>
      {notice ? <small role="status"> {notice}</small> : null}
    </span>
  );
};
