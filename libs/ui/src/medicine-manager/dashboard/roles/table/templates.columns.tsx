import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../../design-system/button/button';
import { PermissionList } from './permission-list';
import type { TemplateRow, TemplatesActions } from '../roles.types';

/** Edit (name + permissions) · Reset (to code) · Apply to all (mass, confirmed). */
const TemplateManage = ({
  tpl,
  onEdit,
  onReset,
  onApplyToAll,
}: { readonly tpl: TemplateRow } & Pick<
  TemplatesActions,
  'onEdit' | 'onReset' | 'onApplyToAll'
>) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <Button size="sm" variant="outline" onClick={() => onEdit(tpl.key)}>
      Edit
    </Button>
    <Button size="sm" variant="ghost" onClick={() => onReset(tpl.key)}>
      Reset
    </Button>
    <Button size="sm" variant="ghost" onClick={() => onApplyToAll(tpl.key)}>
      Apply to all
    </Button>
  </div>
);

export const templateColumns = ({
  canManage,
  ...actions
}: { readonly canManage: boolean } & Pick<
  TemplatesActions,
  'onEdit' | 'onReset' | 'onApplyToAll'
>): ColumnDef<TemplateRow>[] => {
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
      cell: ({ row }) => <TemplateManage tpl={row.original} {...actions} />,
    },
  ];
};
