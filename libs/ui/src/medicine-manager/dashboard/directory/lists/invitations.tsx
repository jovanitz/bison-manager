/**
 * Invitations tab columns — a lifecycle status badge (Pending / Expiring / Expired)
 * plus a ⋯ menu (Copy link · Resend · Regenerate · Revoke). Revoke is destructive,
 * so it goes through a confirmation; the dropdown is non-modal so opening the
 * dialog from it doesn't freeze the page (see the DS gotcha).
 */
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Badge, type BadgeProps } from '../../../../design-system/badge/badge';
import { Button } from '../../../../design-system/button/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../design-system/dropdown-menu/dropdown-menu';
import { ConfirmDialog, type Copy } from '../directory.confirm';
import { relativeDate } from '../directory.columns';
import type {
  DirectoryActions,
  InvitationRow,
  InvitationStatus,
} from '../directory.columns';

type InviteActions = Pick<
  DirectoryActions,
  'onResendInvite' | 'onRegenerate' | 'onRevokeInvitation'
>;

const STATUS: Record<
  InvitationStatus,
  { readonly variant: BadgeProps['variant']; readonly label: string }
> = {
  pending: { variant: 'secondary', label: 'Pending' },
  expiring: { variant: 'warning', label: 'Expiring soon' },
  expired: { variant: 'destructive', label: 'Expired' },
};

const StatusBadge = ({ status }: { readonly status: InvitationStatus }) => {
  const s = STATUS[status];
  return (
    <Badge variant={s.variant} appearance="soft" dot>
      {s.label}
    </Badge>
  );
};

const revokeCopy = (email: string): Copy => ({
  title: 'Revoke invitation?',
  description: `The link for ${email} will stop working. You can invite them again later.`,
  confirmLabel: 'Revoke',
  destructive: true,
});

const InvitationActions = ({
  row,
  actions,
}: {
  readonly row: InvitationRow;
  readonly actions: InviteActions;
}) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Invitation actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* There is no "copy the existing link": only the token's HASH is
              stored, so the plaintext exists once, at issue time. Copying =
              minting a fresh link, which retires the previous one. */}
          <DropdownMenuItem
            onSelect={() => actions.onRegenerate(row.invitationId)}
          >
            Copy new link
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => actions.onResendInvite(row.invitationId)}
          >
            Resend email
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirming(true)}>
            Revoke invitation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        copy={confirming ? revokeCopy(row.email) : null}
        onOpenChange={(open) => (open ? undefined : setConfirming(false))}
        onConfirm={() => {
          actions.onRevokeInvitation(row.invitationId);
          setConfirming(false);
        }}
      />
    </>
  );
};

export const invitationColumns = (
  actions: InviteActions,
): ColumnDef<InvitationRow>[] => [
  { accessorKey: 'email', header: 'Email' },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'expiresAt',
    header: 'Expires',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {relativeDate(row.original.expiresAt)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="text-right">
        <InvitationActions row={row.original} actions={actions} />
      </div>
    ),
  },
];
