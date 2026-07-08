/**
 * Orphans tab columns — identities registered but attached to no org. A ⋯ menu
 * makes them actionable: Invite to an org, or Delete the identity (destructive →
 * confirmation). Non-modal dropdown so the confirm dialog doesn't freeze the page.
 */
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../../../../design-system/button/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../design-system/dropdown-menu/dropdown-menu';
import { ConfirmDialog, type Copy } from '../directory.confirm';
import type { DirectoryActions, OrphanRow } from '../directory.columns';

type OrphanActions = Pick<
  DirectoryActions,
  'onInviteOrphan' | 'onDeleteOrphan'
>;

const deleteCopy = (label: string): Copy => ({
  title: 'Delete identity?',
  description: `${label} will be permanently removed. This can't be undone.`,
  confirmLabel: 'Delete',
  destructive: true,
});

const OrphanMenu = ({
  row,
  actions,
}: {
  readonly row: OrphanRow;
  readonly actions: OrphanActions;
}) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Identity actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => actions.onInviteOrphan(row.userId)}>
            Invite to an org
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirming(true)}>
            Delete identity
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        copy={confirming ? deleteCopy(row.email ?? row.userId) : null}
        onOpenChange={(open) => (open ? undefined : setConfirming(false))}
        onConfirm={() => {
          actions.onDeleteOrphan(row.userId);
          setConfirming(false);
        }}
      />
    </>
  );
};

export const orphanColumns = (
  actions: OrphanActions,
): ColumnDef<OrphanRow>[] => [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => row.original.email ?? '—',
  },
  { accessorKey: 'userId', header: 'User' },
  { accessorKey: 'createdAt', header: 'Registered' },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="text-right">
        <OrphanMenu row={row.original} actions={actions} />
      </div>
    ),
  },
];
