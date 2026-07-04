/**
 * Medicine Manager · Dashboard · Default templates — the seed role catalogue new
 * orgs start from (re-skin of the implemented templates-section).
 *
 * @screen Medicine Manager / Dashboard / Templates
 * @phase draft
 */
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../design-system/button/button';
import { Input } from '../../../design-system/input/input';
import { Alert, AlertDescription } from '../../../design-system/alert/alert';
import { DataTable } from '../../../design-system/data-table/data-table';
import { PermissionList } from './permission-list';

export type TemplateRow = {
  readonly key: string;
  readonly name: string;
  readonly scope: string;
  readonly permissions: readonly string[];
};
export type TemplatesVM = {
  readonly templates: readonly TemplateRow[];
  readonly canManage: boolean;
  readonly notice?: string;
};
export type TemplatesActions = {
  readonly onRename: (key: string, name: string) => void;
  readonly onReset: (key: string) => void;
  readonly onApplyToAll: (key: string) => void;
};

const ManageCell = ({
  tpl,
  onRename,
  onReset,
  onApplyToAll,
}: { readonly tpl: TemplateRow } & TemplatesActions) => {
  const [name, setName] = useState(tpl.name);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Input
        aria-label={`rename ${tpl.key}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-40"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => onRename(tpl.key, name)}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onReset(tpl.key)}>
        Reset
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onApplyToAll(tpl.key)}>
        Apply to all
      </Button>
    </div>
  );
};

const templateColumns = ({
  canManage,
  ...actions
}: {
  readonly canManage: boolean;
} & TemplatesActions): ColumnDef<TemplateRow>[] => {
  const base: ColumnDef<TemplateRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'scope',
      header: 'Scope',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.scope}</span>
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
      cell: ({ row }) => <ManageCell tpl={row.original} {...actions} />,
    },
  ];
};

export const TemplatesView = ({
  vm,
  ...actions
}: { readonly vm: TemplatesVM } & TemplatesActions) => (
  <div className="flex flex-col gap-4">
    <div>
      <h1 className="text-xl font-semibold text-foreground">
        Default templates ({vm.templates.length})
      </h1>
      <p className="text-sm text-muted-foreground">
        The seed catalogue new orgs start from. Editing a template never touches
        live roles.
      </p>
    </div>
    {vm.notice ? (
      <Alert variant="info">
        <AlertDescription>{vm.notice}</AlertDescription>
      </Alert>
    ) : null}
    <DataTable
      columns={templateColumns({ canManage: vm.canManage, ...actions })}
      data={vm.templates}
    />
  </div>
);
