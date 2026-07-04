import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../design-system/dropdown-menu/dropdown-menu';

/** Local row types — decoupled from application DTOs (the container maps to these). */
export type StaffRow = {
  readonly accountId: string;
  readonly email?: string;
  readonly displayName?: string;
};
export type CustomerRow = {
  readonly accountId: string;
  readonly displayName: string;
  readonly email?: string;
};
export type InvitationRow = {
  readonly invitationId: string;
  readonly email: string;
  readonly expiresAt: string;
};
export type OrphanRow = {
  readonly userId: string;
  readonly email?: string;
  readonly createdAt: string;
};

export type DirectoryActions = {
  readonly onBlock: (accountId: string, blocked: boolean) => void;
  readonly onAdmin: (
    accountId: string,
    action: 'disable' | 'enable' | 'promote',
  ) => void;
  readonly onRegenerate: (invitationId: string) => void;
  /** Open an organization's detail (its owner + member roster). */
  readonly onOpenOrg: (accountId: string) => void;
};

const dash = (v?: string) => v ?? '—';

export const staffColumns: ColumnDef<StaffRow>[] = [
  {
    accessorKey: 'displayName',
    header: 'Name',
    cell: ({ row }) => dash(row.original.displayName),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => dash(row.original.email),
  },
  { accessorKey: 'accountId', header: 'Account' },
];

export const orphanColumns: ColumnDef<OrphanRow>[] = [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => dash(row.original.email),
  },
  { accessorKey: 'userId', header: 'User' },
  { accessorKey: 'createdAt', header: 'Registered' },
];

export const invitationColumns = (
  onRegenerate: DirectoryActions['onRegenerate'],
): ColumnDef<InvitationRow>[] => [
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'expiresAt', header: 'Expires' },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRegenerate(row.original.invitationId)}
        >
          Regenerate link
        </Button>
      </div>
    ),
  },
];

const CustomerActions = ({
  id,
  canBlock,
  canAdminAccounts,
  onBlock,
  onAdmin,
}: {
  readonly id: string;
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
} & Pick<DirectoryActions, 'onBlock' | 'onAdmin'>) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Account actions">
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {canBlock ? (
        <>
          <DropdownMenuItem onSelect={() => onBlock(id, true)}>
            Block org
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onBlock(id, false)}>
            Unblock org
          </DropdownMenuItem>
        </>
      ) : null}
      {canBlock && canAdminAccounts ? <DropdownMenuSeparator /> : null}
      {canAdminAccounts ? (
        <>
          <DropdownMenuItem onSelect={() => onAdmin(id, 'disable')}>
            Disable account
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAdmin(id, 'enable')}>
            Enable account
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAdmin(id, 'promote')}>
            Promote to staff
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenuContent>
  </DropdownMenu>
);

export const customerColumns = ({
  canBlock,
  canAdminAccounts,
  onBlock,
  onAdmin,
  onOpenOrg,
}: {
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
} & Pick<
  DirectoryActions,
  'onBlock' | 'onAdmin' | 'onOpenOrg'
>): ColumnDef<CustomerRow>[] => {
  const base: ColumnDef<CustomerRow>[] = [
    {
      accessorKey: 'displayName',
      header: 'Name',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onOpenOrg(row.original.accountId)}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.displayName}
        </button>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => dash(row.original.email),
    },
    { accessorKey: 'accountId', header: 'Account' },
  ];
  if (!canBlock && !canAdminAccounts) return base;
  return [
    ...base,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="text-right">
          <CustomerActions
            id={row.original.accountId}
            canBlock={canBlock}
            canAdminAccounts={canAdminAccounts}
            onBlock={onBlock}
            onAdmin={onAdmin}
          />
        </div>
      ),
    },
  ];
};
