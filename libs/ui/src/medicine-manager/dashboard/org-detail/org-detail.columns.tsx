import type { ColumnDef } from '@tanstack/react-table';
import { Badge, type BadgeProps } from '../../../design-system/badge/badge';
import type { OrgMemberRow, OrgMemberStatus } from './org-detail.types';

const statusVariant: Record<OrgMemberStatus, BadgeProps['variant']> = {
  active: 'success',
  blocked: 'destructive',
  root: 'secondary',
};

export const memberColumns: ColumnDef<OrgMemberRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="flex items-center gap-2 font-medium">
        {row.original.name}
        {row.original.isOwner ? (
          <Badge variant="secondary" className="font-normal">
            Owner
          </Badge>
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
  },
  { accessorKey: 'role', header: 'Role' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status]} appearance="soft" dot>
        {row.original.status}
      </Badge>
    ),
  },
];
