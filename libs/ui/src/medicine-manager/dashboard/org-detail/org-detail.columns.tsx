import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Badge, type BadgeProps } from '../../../design-system/badge/badge';
import { Button } from '../../../design-system/button/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../design-system/dropdown-menu/dropdown-menu';
import type {
  OrgDetailActions,
  OrgMemberRow,
  OrgMemberStatus,
} from './org-detail.types';

/** Precedence: root and a disabled account override a soft block for the badge. */
export const memberStatus = (m: OrgMemberRow): OrgMemberStatus => {
  if (m.isRoot) return 'root';
  if (m.disabled) return 'disabled';
  if (m.blocked) return 'blocked';
  return 'active';
};

/** Shared with the detail panel — one colour language for member state. */
export const memberStatusVariant: Record<
  OrgMemberStatus,
  BadgeProps['variant']
> = {
  active: 'success',
  blocked: 'warning',
  disabled: 'destructive',
  root: 'secondary',
};

/** The org owner and root identities are never blockable/disableable. */
export const isProtectedMember = (m: OrgMemberRow) =>
  m.isOwner || m.isRoot === true;

type MemberActions = Pick<
  OrgDetailActions,
  'onViewMember' | 'onBlockMember' | 'onSetMemberAccount'
>;

/** Only the relevant toggle shows — Block on an active member, Unblock on a blocked one. */
const ModerationItems = ({
  row,
  actions,
}: {
  readonly row: OrgMemberRow;
  readonly actions: MemberActions;
}) => (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onSelect={() => actions.onBlockMember(row.membershipId, !row.blocked)}
    >
      {row.blocked ? 'Unblock in this org' : 'Block in this org'}
    </DropdownMenuItem>
    <DropdownMenuItem
      onSelect={() =>
        actions.onSetMemberAccount(
          row.userId,
          row.disabled ? 'enable' : 'disable',
        )
      }
    >
      {row.disabled ? 'Enable account' : 'Disable account'}
    </DropdownMenuItem>
  </>
);

const MemberMenu = ({
  row,
  actions,
}: {
  readonly row: OrgMemberRow;
  readonly actions: MemberActions;
}) => (
  // modal={false}: "View details" opens the member Sheet; a modal dropdown +
  // that Sheet both lock body pointer-events and the page freezes on close.
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Member actions">
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => actions.onViewMember(row.membershipId)}>
        View details
      </DropdownMenuItem>
      {isProtectedMember(row) ? null : (
        <ModerationItems row={row} actions={actions} />
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const NameCell = ({
  row,
  onView,
}: {
  readonly row: OrgMemberRow;
  readonly onView: () => void;
}) => (
  <button
    type="button"
    onClick={onView}
    className="flex items-center gap-2 font-medium text-foreground hover:underline"
  >
    {row.name}
    {row.isOwner ? (
      <Badge variant="secondary" className="font-normal">
        Owner
      </Badge>
    ) : null}
  </button>
);

const StatusCell = ({ row }: { readonly row: OrgMemberRow }) => (
  <Badge variant={memberStatusVariant[memberStatus(row)]} appearance="soft" dot>
    {memberStatus(row)}
  </Badge>
);

export const memberColumns = (
  actions: MemberActions & { readonly canManage: boolean },
): ColumnDef<OrgMemberRow>[] => {
  const base: ColumnDef<OrgMemberRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <NameCell
          row={row.original}
          onView={() => actions.onViewMember(row.original.membershipId)}
        />
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
      cell: ({ row }) => <StatusCell row={row.original} />,
    },
  ];
  if (!actions.canManage) return base;
  return [
    ...base,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="text-right">
          <MemberMenu row={row.original} actions={actions} />
        </div>
      ),
    },
  ];
};
