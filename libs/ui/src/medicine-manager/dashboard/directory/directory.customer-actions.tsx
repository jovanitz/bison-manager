/**
 * The ⋯ row menu for the Organizations table. Every action is consequential, so
 * a pick doesn't fire immediately — it stages a `PendingAction` and opens a
 * confirmation dialog; the real onBlock/onAdmin runs only on confirm. The dialog
 * is a sibling of the menu (not nested) so focus hands off cleanly.
 */
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../design-system/dropdown-menu/dropdown-menu';
import { ConfirmActionDialog, type PendingAction } from './directory.confirm';
import type { CustomerRow, DirectoryActions } from './directory.columns';

/** Only the relevant toggle shows — Block on an active org, Unblock on a blocked one. */
const BlockItem = ({
  blocked,
  onPick,
}: {
  readonly blocked?: boolean | undefined;
  readonly onPick: (next: boolean) => void;
}) =>
  blocked ? (
    <DropdownMenuItem onSelect={() => onPick(false)}>
      Unblock org
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem onSelect={() => onPick(true)}>Block org</DropdownMenuItem>
  );

const AccountItems = ({
  disabled,
  onPick,
}: {
  readonly disabled?: boolean | undefined;
  readonly onPick: (action: 'disable' | 'enable' | 'promote') => void;
}) => (
  <>
    {disabled ? (
      <DropdownMenuItem onSelect={() => onPick('enable')}>
        Enable account
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem onSelect={() => onPick('disable')}>
        Disable account
      </DropdownMenuItem>
    )}
    <DropdownMenuItem onSelect={() => onPick('promote')}>
      Promote to staff
    </DropdownMenuItem>
  </>
);

export const CustomerActions = ({
  row,
  canBlock,
  canAdminAccounts,
  onBlock,
  onAdmin,
}: {
  readonly row: CustomerRow;
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
} & Pick<DirectoryActions, 'onBlock' | 'onAdmin'>) => {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const run = () => {
    if (pending?.kind === 'block') onBlock(row.accountId, pending.next);
    if (pending?.kind === 'account') onAdmin(row.accountId, pending.action);
    setPending(null);
  };
  return (
    <>
      {/* modal={false}: a modal dropdown + the confirm dialog both lock body
          pointer-events; the dialog then restores the dropdown's "none" on
          close, freezing the page. Non-modal dropdown → only the dialog locks. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canBlock ? (
            <BlockItem
              blocked={row.blocked}
              onPick={(next) => setPending({ kind: 'block', next })}
            />
          ) : null}
          {canBlock && canAdminAccounts ? <DropdownMenuSeparator /> : null}
          {canAdminAccounts ? (
            <AccountItems
              disabled={row.disabled}
              onPick={(action) => setPending({ kind: 'account', action })}
            />
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        pending={pending}
        orgName={row.displayName}
        onCancel={() => setPending(null)}
        onConfirm={run}
      />
    </>
  );
};
