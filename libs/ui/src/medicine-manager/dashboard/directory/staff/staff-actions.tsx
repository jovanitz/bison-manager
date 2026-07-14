/**
 * The ⋯ row menu for the Staff table — mirrors the Organizations moderation menu
 * (Block/Unblock · Disable/Enable · Demote from staff). Root and self accounts
 * are guarded: every action renders disabled under a reason label, so staff can
 * neither lock themselves out nor touch the protected root. Consequential picks
 * stage a confirmation (the shared ConfirmDialog); the dropdown is non-modal so
 * opening the dialog from it doesn't freeze the page.
 */
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../../../../design-system/button/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../design-system/dropdown-menu/dropdown-menu';
import { ConfirmDialog, type Copy } from '../directory.confirm';
import type { DirectoryActions, StaffRow } from '../directory.columns';

type StaffMod = Pick<
  DirectoryActions,
  'onBlockStaff' | 'onDisableStaff' | 'onDemoteStaff'
>;

type Pending =
  | { readonly kind: 'block'; readonly next: boolean }
  | { readonly kind: 'disable'; readonly next: boolean }
  | { readonly kind: 'demote' };

/** Why moderation is off for this row — self first, then the protected root. */
const protectionReason = (row: StaffRow): string | null => {
  if (row.isSelf) return 'This is your account';
  if (row.isRoot) return 'Protected root account';
  return null;
};

const blockCopy = (name: string, next: boolean): Copy =>
  next
    ? {
        title: 'Block staff member?',
        description: `${name} loses dashboard access until you unblock them. Reversible.`,
        confirmLabel: 'Block',
        destructive: true,
      }
    : {
        title: 'Unblock staff member?',
        description: `Restore dashboard access for ${name}.`,
        confirmLabel: 'Unblock',
        destructive: false,
      };

const disableCopy = (name: string, next: boolean): Copy =>
  next
    ? {
        title: 'Disable account?',
        description: `Turns off ${name}'s identity across every app. Reversible.`,
        confirmLabel: 'Disable',
        destructive: true,
      }
    : {
        title: 'Enable account?',
        description: `Turn ${name}'s account back on.`,
        confirmLabel: 'Enable',
        destructive: false,
      };

const copyFor = (p: Pending, name: string): Copy => {
  if (p.kind === 'block') return blockCopy(name, p.next);
  if (p.kind === 'disable') return disableCopy(name, p.next);
  return {
    title: 'Demote from staff?',
    description: `${name} loses staff access and becomes a regular identity. You can re-invite them later.`,
    confirmLabel: 'Demote',
    destructive: true,
  };
};

const BlockItem = ({
  blocked,
  locked,
  onPick,
}: {
  readonly blocked?: boolean | undefined;
  readonly locked: boolean;
  readonly onPick: (next: boolean) => void;
}) =>
  blocked ? (
    <DropdownMenuItem disabled={locked} onSelect={() => onPick(false)}>
      Unblock
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem disabled={locked} onSelect={() => onPick(true)}>
      Block
    </DropdownMenuItem>
  );

const AccountItem = ({
  off,
  locked,
  onPick,
}: {
  readonly off?: boolean | undefined;
  readonly locked: boolean;
  readonly onPick: (next: boolean) => void;
}) =>
  off ? (
    <DropdownMenuItem disabled={locked} onSelect={() => onPick(false)}>
      Enable account
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem disabled={locked} onSelect={() => onPick(true)}>
      Disable account
    </DropdownMenuItem>
  );

const StaffMenu = ({
  row,
  canBlock,
  canAdminAccounts,
  reason,
  onPick,
}: {
  readonly row: StaffRow;
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
  readonly reason: string | null;
  readonly onPick: (p: Pending) => void;
}) => {
  const locked = Boolean(reason);
  return (
    <DropdownMenuContent align="end">
      {reason ? (
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {reason}
        </DropdownMenuLabel>
      ) : null}
      {canBlock ? (
        <BlockItem
          blocked={row.blocked}
          locked={locked}
          onPick={(next) => onPick({ kind: 'block', next })}
        />
      ) : null}
      {canAdminAccounts ? (
        <AccountItem
          off={row.disabled}
          locked={locked}
          onPick={(next) => onPick({ kind: 'disable', next })}
        />
      ) : null}
      {canAdminAccounts ? <DropdownMenuSeparator /> : null}
      {canAdminAccounts ? (
        <DropdownMenuItem
          disabled={locked}
          className="text-destructive focus:text-destructive"
          onSelect={() => onPick({ kind: 'demote' })}
        >
          Demote from staff
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
  );
};

export const StaffActions = ({
  row,
  canBlock,
  canAdminAccounts,
  onBlockStaff,
  onDisableStaff,
  onDemoteStaff,
}: {
  readonly row: StaffRow;
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
} & StaffMod) => {
  const [pending, setPending] = useState<Pending | null>(null);
  const reason = protectionReason(row);
  const run = () => {
    if (pending?.kind === 'block') onBlockStaff(row.accountId, pending.next);
    if (pending?.kind === 'disable')
      onDisableStaff(row.accountId, pending.next);
    if (pending?.kind === 'demote') onDemoteStaff(row.accountId);
    setPending(null);
  };
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Staff actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <StaffMenu
          row={row}
          canBlock={canBlock}
          canAdminAccounts={canAdminAccounts}
          reason={reason}
          onPick={setPending}
        />
      </DropdownMenu>
      <ConfirmDialog
        open={pending !== null}
        copy={
          pending ? copyFor(pending, row.displayName ?? 'This member') : null
        }
        onOpenChange={(o) => (o ? undefined : setPending(null))}
        onConfirm={run}
      />
    </>
  );
};
