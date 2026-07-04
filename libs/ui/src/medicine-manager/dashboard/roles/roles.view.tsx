/**
 * Medicine Manager · Dashboard · Roles — named permission bundles (re-skin of
 * the implemented roles-section).
 *
 * @screen Medicine Manager / Dashboard / Roles
 * @phase draft
 */
import { useState, type FormEvent } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../design-system/button/button';
import { Badge } from '../../../design-system/badge/badge';
import { Input } from '../../../design-system/input/input';
import { Label } from '../../../design-system/label/label';
import { Alert, AlertDescription } from '../../../design-system/alert/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../design-system/select/select';
import { DataTable } from '../../../design-system/data-table/data-table';
import { PermissionList } from './permission-list';

export type RoleRow = {
  readonly id: string;
  readonly name: string;
  readonly scopeLabel: string;
  readonly permissions: readonly string[];
  readonly isDefault: boolean;
  readonly synced: boolean;
};
export type RolesVM = {
  readonly roles: readonly RoleRow[];
  readonly canManage: boolean;
  readonly notice?: string;
};
export type RolesActions = {
  readonly onCreate: (input: {
    name: string;
    action: string;
    scope: string;
  }) => void;
  readonly onReset: (id: string) => void;
  readonly onDelete: (id: string) => void;
};

const CreateRoleForm = ({ onCreate }: Pick<RolesActions, 'onCreate'>) => {
  const [name, setName] = useState('');
  const [action, setAction] = useState('');
  const [scope, setScope] = useState('any');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onCreate({ name, action, scope });
    setName('');
    setAction('');
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="role-name">Role name</Label>
        <Input
          id="role-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Support"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="role-action">Permission</Label>
        <Input
          id="role-action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="staff.read"
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Scope</Label>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">any</SelectItem>
            <SelectItem value="own">own</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">Create role</Button>
    </form>
  );
};

const roleColumns = ({
  canManage,
  onReset,
  onDelete,
}: { readonly canManage: boolean } & Pick<
  RolesActions,
  'onReset' | 'onDelete'
>): ColumnDef<RoleRow>[] => {
  const base: ColumnDef<RoleRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.name}
          {row.original.isDefault ? (
            <Badge variant="secondary" className="ml-2 font-normal">
              {row.original.synced ? 'default' : 'forked'}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: 'scopeLabel',
      header: 'Scope',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.scopeLabel}</span>
      ),
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
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.isDefault ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReset(row.original.id)}
            >
              Reset
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(row.original.id)}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];
};

export const RolesView = ({
  vm,
  onCreate,
  onReset,
  onDelete,
}: { readonly vm: RolesVM } & RolesActions) => (
  <div className="flex flex-col gap-4">
    <div>
      <h1 className="text-xl font-semibold text-foreground">
        Roles ({vm.roles.length})
      </h1>
      <p className="text-sm text-muted-foreground">
        Named permission bundles assigned to memberships.
      </p>
    </div>
    {vm.notice ? (
      <Alert variant="info">
        <AlertDescription>{vm.notice}</AlertDescription>
      </Alert>
    ) : null}
    {vm.canManage ? <CreateRoleForm onCreate={onCreate} /> : null}
    <DataTable
      columns={roleColumns({ canManage: vm.canManage, onReset, onDelete })}
      data={vm.roles}
    />
  </div>
);
