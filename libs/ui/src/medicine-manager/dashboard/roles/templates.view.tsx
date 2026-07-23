/**
 * Medicine Manager · Dashboard · Default templates — the seed role catalogue new
 * orgs start from (ADR-0013/0014). Editing a template (name + permissions) only
 * reseeds NEW orgs; existing roles change solely via "Apply to all", which force-
 * overwrites every live instance (incl. org-forked) — so it is confirm-gated and
 * its result count surfaces via `notice`.
 *
 * @screen Medicine Manager / Dashboard / Templates
 * @phase approved
 *
 * Presentational: a pure function of (ViewModel + actions). `form`,
 * `pendingReset`, `pendingApply`, `loading`, `error`, `notice`, `canManage` are
 * DATA on the VM; only the draft/inputs are view-local.
 */
import { Skeleton } from '../../../design-system/skeleton/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';
import { DataTable } from '../../../design-system/data-table/data-table';
import { templateColumns } from './table/templates.columns';
import { TemplateFormDialog } from './editor/template-form';
import { ConfirmDialog } from './confirm/confirm-dialog';
import type { TemplatesActions, TemplatesVM } from './roles.types';

const Header = ({ count }: { readonly count: number }) => (
  <div>
    <h1 className="text-xl font-semibold text-foreground">
      Default templates ({count})
    </h1>
    <p className="text-sm text-muted-foreground">
      The seed catalogue new orgs start from. Editing never touches live roles —
      “Apply to all” does.
    </p>
  </div>
);

type OverlayActions = Pick<
  TemplatesActions,
  | 'onSubmitForm'
  | 'onCancelForm'
  | 'onConfirmReset'
  | 'onCancelReset'
  | 'onConfirmApply'
  | 'onCancelApply'
>;

const TemplateOverlays = ({
  vm,
  onSubmitForm,
  onCancelForm,
  onConfirmReset,
  onCancelReset,
  onConfirmApply,
  onCancelApply,
}: { readonly vm: TemplatesVM } & OverlayActions) => (
  <>
    {vm.form ? (
      <TemplateFormDialog
        form={vm.form}
        onSubmitForm={onSubmitForm}
        onCancelForm={onCancelForm}
      />
    ) : null}
    {vm.pendingReset ? (
      <ConfirmDialog
        title={`Reset “${vm.pendingReset.name}” template?`}
        description="Restores this template to its code definition. Live roles are untouched — use “Apply to all” to push it to them."
        confirmLabel="Reset template"
        errorTitle="Couldn’t reset the template"
        loading={vm.pendingReset.resetting}
        error={vm.pendingReset.error}
        onConfirm={onConfirmReset}
        onCancel={onCancelReset}
      />
    ) : null}
    {vm.pendingApply ? (
      <ConfirmDialog
        title={`Apply “${vm.pendingApply.name}” to all?`}
        description={
          <>
            This forces <strong>every</strong> live role seeded from this
            template — including org-forked ones with local edits — back to it.
            Their customizations are overwritten. This cannot be undone.
          </>
        }
        confirmLabel="Apply to all"
        errorTitle="Couldn’t apply the template"
        destructive
        loading={vm.pendingApply.applying}
        error={vm.pendingApply.error}
        onConfirm={onConfirmApply}
        onCancel={onCancelApply}
      />
    ) : null}
  </>
);

export const TemplatesView = ({
  vm,
  onEdit,
  onReset,
  onApplyToAll,
  ...overlay
}: { readonly vm: TemplatesVM } & TemplatesActions) => {
  if (vm.loading) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="flex flex-col gap-4">
      <Header count={vm.templates.length} />
      {vm.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load the templates</AlertTitle>
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      {vm.notice ? (
        <Alert variant="info">
          <AlertDescription>{vm.notice}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        columns={templateColumns({
          canManage: vm.canManage,
          onEdit,
          onReset,
          onApplyToAll,
        })}
        data={vm.templates}
        searchPlaceholder="Search templates…"
        empty="No templates."
      />
      <TemplateOverlays vm={vm} {...overlay} />
    </div>
  );
};
