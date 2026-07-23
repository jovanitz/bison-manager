import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../../../../design-system/badge/badge';
import { Button } from '../../../../design-system/button/button';
import { PermissionList } from './permission-list';
import type { RoleRow, RolesActions } from '../roles.types';

const RoleName = ({ role }: { readonly role: RoleRow }) => (
  <span className="flex items-center gap-2 font-medium">
    {role.name}
    {role.isDefault ? (
      <Badge variant="secondary" appearance="soft">
        {role.synced ? 'default' : 'forked'}
      </Badge>
    ) : null}
  </span>
);

/** Edit is always offered; a default role Resets (to factory), a custom Deletes. */
const RoleManage = ({
  role,
  onEdit,
  onReset,
  onDelete,
}: { readonly role: RoleRow } & Pick<
  RolesActions,
  'onEdit' | 'onReset' | 'onDelete'
>) => (
  <div className="flex justify-end gap-2">
    <Button size="sm" variant="outline" onClick={() => onEdit(role.id)}>
      Edit
    </Button>
    {role.isDefault ? (
      <Button size="sm" variant="ghost" onClick={() => onReset(role.id)}>
        Reset
      </Button>
    ) : (
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive focus:text-destructive"
        onClick={() => onDelete(role.id)}
      >
        Delete
      </Button>
    )}
  </div>
);

export const roleColumns = ({
  canManage,
  ...actions
}: { readonly canManage: boolean } & Pick<
  RolesActions,
  'onEdit' | 'onReset' | 'onDelete'
>): ColumnDef<RoleRow>[] => {
  const base: ColumnDef<RoleRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <RoleName role={row.original} />,
    },
    {
      id: 'permissions',
      header: 'Permissions',
      enableSorting: false,
      cell: ({ row }) => (
        <PermissionList permissions={row.original.permissions} />
      ),
    },
  ];
  if (!canManage) return base;
  return [
    ...base,
    {
      id: 'manage',
      header: () => <div className="text-right">Manage</div>,
      enableSorting: false,
      cell: ({ row }) => <RoleManage role={row.original} {...actions} />,
    },
  ];
};
