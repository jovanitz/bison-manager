/**
 * Medicine Manager · Dashboard · Roles — the staff-editable catalog of named
 * permission bundles (ADR-0011). Platform roles only (this screen); a role is a
 * name + an editable permission set, created/edited through the shared editor,
 * with confirm gates on the destructive levers (delete custom / reset default).
 *
 * @screen Medicine Manager / Dashboard / Roles
 * @phase approved
 *
 * Presentational: a pure function of (ViewModel + actions). The open dialogs
 * (`form`, `pendingDelete`, `pendingReset`), `loading`, `error`, `notice` and
 * `canManage` are all DATA on the VM; only the draft/inputs are view-local.
 */
import { Plus } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import { Skeleton } from '../../../design-system/skeleton/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';
import { DataTable } from '../../../design-system/data-table/data-table';
import { roleColumns } from './table/roles.columns';
import { RoleFormDialog } from './editor/role-form';
import { ConfirmDialog } from './confirm/confirm-dialog';
import type { RolesActions, RolesVM } from './roles.types';

const Header = ({
  count,
  canManage,
  onCreate,
}: { readonly count: number; readonly canManage: boolean } & Pick<
  RolesActions,
  'onCreate'
>) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold text-foreground">Roles ({count})</h1>
      <p className="text-sm text-muted-foreground">
        Named permission bundles assigned to memberships.
      </p>
    </div>
    {canManage ? (
      <Button onClick={onCreate}>
        <Plus /> Create role
      </Button>
    ) : null}
  </div>
);

type OverlayActions = Pick<
  RolesActions,
  | 'onSubmitForm'
  | 'onCancelForm'
  | 'onConfirmDelete'
  | 'onCancelDelete'
  | 'onConfirmReset'
  | 'onCancelReset'
>;

const RoleOverlays = ({
  vm,
  onSubmitForm,
  onCancelForm,
  onConfirmDelete,
  onCancelDelete,
  onConfirmReset,
  onCancelReset,
}: { readonly vm: RolesVM } & OverlayActions) => (
  <>
    {vm.form ? (
      <RoleFormDialog
        form={vm.form}
        onSubmitForm={onSubmitForm}
        onCancelForm={onCancelForm}
      />
    ) : null}
    {vm.pendingDelete ? (
      <ConfirmDialog
        title={`Delete “${vm.pendingDelete.name}”?`}
        description="This custom role is removed. The server refuses while it is still assigned to a member — reassign them first."
        confirmLabel="Delete role"
        errorTitle="Couldn’t delete the role"
        destructive
        loading={vm.pendingDelete.deleting}
        error={vm.pendingDelete.error}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    ) : null}
    {vm.pendingReset ? (
      <ConfirmDialog
        title={`Reset “${vm.pendingReset.name}”?`}
        description="Restores this default role to its factory template — any forked (staff-edited) permissions are discarded. Applies live to every holder."
        confirmLabel="Reset role"
        errorTitle="Couldn’t reset the role"
        loading={vm.pendingReset.resetting}
        error={vm.pendingReset.error}
        onConfirm={onConfirmReset}
        onCancel={onCancelReset}
      />
    ) : null}
  </>
);

export const RolesView = ({
  vm,
  onCreate,
  onEdit,
  onReset,
  onDelete,
  ...overlay
}: { readonly vm: RolesVM } & RolesActions) => {
  if (vm.loading) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="flex flex-col gap-4">
      <Header
        count={vm.roles.length}
        canManage={vm.canManage}
        onCreate={onCreate}
      />
      {vm.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load the roles</AlertTitle>
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      {vm.notice ? (
        <Alert variant="info">
          <AlertDescription>{vm.notice}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        columns={roleColumns({
          canManage: vm.canManage,
          onEdit,
          onReset,
          onDelete,
        })}
        data={vm.roles}
        searchPlaceholder="Search roles…"
        empty="No roles yet."
      />
      <RoleOverlays vm={vm} {...overlay} />
    </div>
  );
};
