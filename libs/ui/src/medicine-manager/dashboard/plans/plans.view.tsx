/**
 * Medicine Manager · Dashboard · Plans — the staff-editable plan catalog
 * (ADR-0016): entitlement limits, trials, nullable prices and the hidden
 * legacy/custom plan playbook, with the blast-radius confirm gate on edits.
 *
 * @screen Medicine Manager / Dashboard / Plans
 * @phase approved
 *
 * Presentational: a pure function of (ViewModel + actions). `canManage`, the
 * blast-radius preview (`pendingEdit`), the create/edit form (`form`) and the
 * retire confirm (`pendingRetire`) are DATA on the VM; only controlled inputs
 * (the reason field here, the form fields in plans.form.tsx) are view-local.
 */
import { Plus } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import { DataTable } from '../../../design-system/data-table/data-table';
import { Skeleton } from '../../../design-system/skeleton/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';
import { planColumns } from './plans.columns';
import { PlanFormDialog } from './form/plans.form';
import { ReviewChangesDialog } from './review/review';
import { RetireConfirmDialog } from './review/retire';
import { ResetConfirmDialog } from './review/reset';
import { SetDefaultConfirmDialog } from './review/set-default';
import type { PlansActions, PlansVM } from './plans.types';

const Header = ({
  canManage,
  onCreate,
}: { readonly canManage: boolean } & Pick<PlansActions, 'onCreate'>) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold text-foreground">Plans</h1>
      <p className="text-sm text-muted-foreground">
        The staff-editable catalog: entitlements, trials and prices.
      </p>
    </div>
    {canManage ? (
      <Button onClick={onCreate}>
        <Plus /> Create plan
      </Button>
    ) : null}
  </div>
);

/** The one-at-a-time flow overlays (create/edit form, blast-radius, retire,
 *  reset, set-default). Split out so `PlansView` stays under the size cap. */
type OverlayActions = Pick<
  PlansActions,
  | 'onConfirmEdit'
  | 'onCancelEdit'
  | 'onSubmitForm'
  | 'onCancelForm'
  | 'onConfirmRetire'
  | 'onCancelRetire'
  | 'onConfirmReset'
  | 'onCancelReset'
  | 'onConfirmSetDefault'
  | 'onCancelSetDefault'
>;

const PlanOverlays = ({
  vm,
  onConfirmEdit,
  onCancelEdit,
  onSubmitForm,
  onCancelForm,
  onConfirmRetire,
  onCancelRetire,
  onConfirmReset,
  onCancelReset,
  onConfirmSetDefault,
  onCancelSetDefault,
}: { readonly vm: PlansVM } & OverlayActions) => (
  <>
    {vm.pendingEdit ? (
      <ReviewChangesDialog
        pending={vm.pendingEdit}
        onConfirmEdit={onConfirmEdit}
        onCancelEdit={onCancelEdit}
      />
    ) : null}
    {vm.form ? (
      <PlanFormDialog
        form={vm.form}
        onSubmitForm={onSubmitForm}
        onCancelForm={onCancelForm}
      />
    ) : null}
    {vm.pendingRetire ? (
      <RetireConfirmDialog
        pendingRetire={vm.pendingRetire}
        onConfirmRetire={onConfirmRetire}
        onCancelRetire={onCancelRetire}
      />
    ) : null}
    {vm.pendingReset ? (
      <ResetConfirmDialog
        pendingReset={vm.pendingReset}
        onConfirmReset={onConfirmReset}
        onCancelReset={onCancelReset}
      />
    ) : null}
    {vm.pendingSetDefault ? (
      <SetDefaultConfirmDialog
        pendingSetDefault={vm.pendingSetDefault}
        onConfirmSetDefault={onConfirmSetDefault}
        onCancelSetDefault={onCancelSetDefault}
      />
    ) : null}
  </>
);

export const PlansView = ({
  vm,
  onCreate,
  onEdit,
  onReset,
  onRetire,
  onSetDefault,
  ...overlay
}: { readonly vm: PlansVM } & PlansActions) => {
  if (vm.loading) return <Skeleton className="h-96 w-full" />;
  if (vm.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&rsquo;t load the plan catalog</AlertTitle>
        <AlertDescription>{vm.error}</AlertDescription>
      </Alert>
    );
  return (
    <div className="flex flex-col gap-6">
      <Header canManage={vm.canManage} onCreate={onCreate} />
      <DataTable
        columns={planColumns({
          canManage: vm.canManage,
          onEdit,
          onReset,
          onRetire,
          onSetDefault,
        })}
        data={vm.plans}
        searchPlaceholder="Search plans…"
        empty="No plans in the catalog."
      />
      <PlanOverlays vm={vm} {...overlay} />
    </div>
  );
};
