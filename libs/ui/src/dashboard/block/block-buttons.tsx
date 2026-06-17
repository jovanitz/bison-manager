import { useState } from 'react';

/**
 * Presentational soft-block controls. No flow logic: it calls `onBlock(blocked)`
 * (wired to a store action) and shows the notice the action returns. Which
 * use case runs (org vs identity) is decided in the controller.
 */
export const BlockButtons = ({
  label,
  onBlock,
}: {
  readonly label: string;
  readonly onBlock: (blocked: boolean) => Promise<string>;
}) => {
  const [notice, setNotice] = useState<string | undefined>();
  const run = async (blocked: boolean) => {
    setNotice(undefined);
    setNotice(await onBlock(blocked));
  };
  return (
    <span aria-label={label}>
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
