/**
 * Organizations (customers) table columns — split from directory.columns to
 * stay under the size caps. Surfaces each org's live state as a Status badge
 * (Active / Blocked / Disabled) and offers only the RELEVANT toggle in the ⋯
 * menu (Block on an active org, Unblock on a blocked one). Row types + the
 * shared DirectoryActions live in directory.columns.
 */
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../design-system/badge/badge';
import { CustomerActions } from './directory.customer-actions';
import { StatusHeader } from './directory.status-legend';
import { paymentColumn } from './directory.columns';
import type { CustomerRow, DirectoryActions } from './directory.columns';

/** Precedence: a disabled account overrides a soft block for the badge. */
type OrgStatus = 'active' | 'blocked' | 'disabled';
const orgStatus = (r: CustomerRow): OrgStatus => {
  if (r.disabled) return 'disabled';
  if (r.blocked) return 'blocked';
  return 'active';
};

const STATUS: Record<
  OrgStatus,
  {
    readonly variant: 'success' | 'warning' | 'destructive';
    readonly label: string;
  }
> = {
  active: { variant: 'success', label: 'Active' },
  blocked: { variant: 'warning', label: 'Blocked' },
  disabled: { variant: 'destructive', label: 'Disabled' },
};

/** The org's live state at a glance — color + dot + label. */
const OrgStatusBadge = ({ row }: { readonly row: CustomerRow }) => {
  const s = STATUS[orgStatus(row)];
  return (
    <Badge variant={s.variant} appearance="soft" dot>
      {s.label}
    </Badge>
  );
};

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
      id: 'status',
      header: () => <StatusHeader />,
      cell: ({ row }) => <OrgStatusBadge row={row.original} />,
    },
    paymentColumn,
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
            row={row.original}
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
