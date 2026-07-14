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
import {
  cancelDeletionCopy,
  ConfirmActionDialog,
  ConfirmDialog,
  type PendingAction,
} from './directory.confirm';
import { DeleteOrgDialog } from './organizations/delete-org-dialog';
import type { CustomerRow, DirectoryActions } from './directory.columns';

/** Deletion actions on the ⋯ menu — split out so the trigger's Pick stays tidy. */
type DeletionActions = Pick<
  DirectoryActions,
  'onScheduleDeletion' | 'onCancelDeletion' | 'onExportOrg'
>;

/** Dormant orgs offer "Delete…"; already-scheduled ones offer "Cancel deletion". */
const DeletionItem = ({
  row,
  onDelete,
  onCancel,
}: {
  readonly row: CustomerRow;
  readonly onDelete: () => void;
  readonly onCancel: () => void;
}) => {
  if (row.pendingDeletionUntil)
    return (
      <DropdownMenuItem onSelect={onCancel}>Cancel deletion</DropdownMenuItem>
    );
  if (row.dormant)
    return (
      <DropdownMenuItem
        onSelect={onDelete}
        className="text-destructive focus:text-destructive"
      >
        Delete organization…
      </DropdownMenuItem>
    );
  return null;
};

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

/** The ⋯ dropdown content — block/account toggles + the deletion entry. */
const ActionsMenu = ({
  row,
  canBlock,
  canAdminAccounts,
  onModerate,
  onDelete,
  onCancelDeletion,
}: {
  readonly row: CustomerRow;
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
  readonly onModerate: (p: PendingAction) => void;
  readonly onDelete: () => void;
  readonly onCancelDeletion: () => void;
}) => {
  const showDeletion =
    canAdminAccounts && Boolean(row.dormant || row.pendingDeletionUntil);
  return (
    <DropdownMenuContent align="end">
      {canBlock ? (
        <BlockItem
          blocked={row.blocked}
          onPick={(next) => onModerate({ kind: 'block', next })}
        />
      ) : null}
      {canBlock && canAdminAccounts ? <DropdownMenuSeparator /> : null}
      {canAdminAccounts ? (
        <AccountItems
          disabled={row.disabled}
          onPick={(action) => onModerate({ kind: 'account', action })}
        />
      ) : null}
      {showDeletion ? <DropdownMenuSeparator /> : null}
      {showDeletion ? (
        <DeletionItem
          row={row}
          onDelete={onDelete}
          onCancel={onCancelDeletion}
        />
      ) : null}
    </DropdownMenuContent>
  );
};

export const CustomerActions = ({
  row,
  canBlock,
  canAdminAccounts,
  onBlock,
  onAdmin,
  onScheduleDeletion,
  onCancelDeletion,
  onExportOrg,
}: {
  readonly row: CustomerRow;
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
} & Pick<DirectoryActions, 'onBlock' | 'onAdmin'> &
  DeletionActions) => {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [canceling, setCanceling] = useState(false);
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
        <ActionsMenu
          row={row}
          canBlock={canBlock}
          canAdminAccounts={canAdminAccounts}
          onModerate={setPending}
          onDelete={() => setDeleting(true)}
          onCancelDeletion={() => setCanceling(true)}
        />
      </DropdownMenu>
      <ConfirmActionDialog
        pending={pending}
        orgName={row.displayName}
        onCancel={() => setPending(null)}
        onConfirm={run}
      />
      <DeleteOrgDialog
        open={deleting}
        orgName={row.displayName}
        onOpenChange={setDeleting}
        onExport={() => onExportOrg(row.accountId)}
        onConfirm={() => {
          onScheduleDeletion(row.accountId);
          setDeleting(false);
        }}
      />
      <ConfirmDialog
        open={canceling}
        copy={canceling ? cancelDeletionCopy(row.displayName) : null}
        onOpenChange={(o) => (o ? undefined : setCanceling(false))}
        onConfirm={() => {
          onCancelDeletion(row.accountId);
          setCanceling(false);
        }}
      />
    </>
  );
};
