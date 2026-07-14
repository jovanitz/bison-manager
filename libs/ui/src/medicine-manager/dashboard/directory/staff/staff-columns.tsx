/**
 * Staff table columns — at parity with Organizations: a Status badge
 * (Active / Blocked / Disabled) and a ⋯ moderation menu (Block · Disable ·
 * Demote), with root/self guarded in the menu. Row types + the shared
 * DirectoryActions live in ../directory.columns.
 */
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../design-system/badge/badge';
import {
  NameWithAvatar,
  relativeDate,
  type DirectoryActions,
  type StaffRow,
} from '../directory.columns';
import { StaffActions } from './staff-actions';

const dash = (v?: string) => v ?? '—';

type StaffStatus = 'active' | 'blocked' | 'disabled';

/** Precedence: a disabled identity outranks a soft block for the badge. */
const staffStatus = (r: StaffRow): StaffStatus => {
  if (r.disabled) return 'disabled';
  if (r.blocked) return 'blocked';
  return 'active';
};

const STATUS: Record<
  StaffStatus,
  {
    readonly variant: 'success' | 'warning' | 'destructive';
    readonly label: string;
  }
> = {
  active: { variant: 'success', label: 'Active' },
  blocked: { variant: 'warning', label: 'Blocked' },
  disabled: { variant: 'destructive', label: 'Disabled' },
};

const StaffStatusBadge = ({ row }: { readonly row: StaffRow }) => {
  const s = STATUS[staffStatus(row)];
  return (
    <Badge variant={s.variant} appearance="soft" dot>
      {s.label}
    </Badge>
  );
};

type StaffColumnActions = Pick<
  DirectoryActions,
  'onOpenStaff' | 'onBlockStaff' | 'onDisableStaff' | 'onDemoteStaff'
>;

export const staffColumns = ({
  canBlock,
  canAdminAccounts,
  onOpenStaff,
  onBlockStaff,
  onDisableStaff,
  onDemoteStaff,
}: {
  readonly canBlock: boolean;
  readonly canAdminAccounts: boolean;
} & StaffColumnActions): ColumnDef<StaffRow>[] => {
  const base: ColumnDef<StaffRow>[] = [
    {
      accessorKey: 'displayName',
      header: 'Name',
      cell: ({ row }) => (
        <NameWithAvatar
          name={dash(row.original.displayName)}
          onClick={() => onOpenStaff(row.original.accountId)}
        />
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => dash(row.original.email),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StaffStatusBadge row={row.original} />,
    },
    {
      accessorKey: 'lastActiveAt',
      header: 'Last active',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {relativeDate(row.original.lastActiveAt)}
        </span>
      ),
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
          <StaffActions
            row={row.original}
            canBlock={canBlock}
            canAdminAccounts={canAdminAccounts}
            onBlockStaff={onBlockStaff}
            onDisableStaff={onDisableStaff}
            onDemoteStaff={onDemoteStaff}
          />
        </div>
      ),
    },
  ];
};
