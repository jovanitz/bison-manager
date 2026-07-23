import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PlansView } from './plans.view';
import type {
  BlastRadiusVM,
  PlanFormVM,
  PlanRow,
  PlansActions,
  PlansVM,
  ResetConfirmVM,
  RetireConfirmVM,
  SetDefaultConfirmVM,
} from './plans.types';
import {
  plansVM,
  loadingVM,
  errorVM,
  blastRadiusVM,
  formCreateVM,
  formEditVM,
  retireVM,
  resetVM,
  setDefaultVM,
  emptyDraft,
  draftFromPlan,
  demoBlast,
} from './plans.fixtures';
import { DashboardShell } from '../dashboard.shell';

const meta: Meta<typeof PlansView> = {
  title: 'Medicine Manager/Dashboard/Plans',
  component: PlansView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof PlansView>;

const actions = {
  onCreate: () => undefined,
  onEdit: () => undefined,
  onRetire: () => undefined,
  onReset: () => undefined,
  onSetDefault: () => undefined,
  onConfirmSetDefault: () => undefined,
  onCancelSetDefault: () => undefined,
  onConfirmEdit: () => undefined,
  onCancelEdit: () => undefined,
  onSubmitForm: () => undefined,
  onCancelForm: () => undefined,
  onConfirmRetire: () => undefined,
  onCancelRetire: () => undefined,
  onConfirmReset: () => undefined,
  onCancelReset: () => undefined,
};

const inShell = (vm: PlansVM) =>
  function Render() {
    return (
      <DashboardShell active="Plans">
        <PlansView vm={vm} {...actions} />
      </DashboardShell>
    );
  };

/** One open flow overlay at a time — the story-local state the host drives. */
type Flow = {
  readonly form?: PlanFormVM | undefined;
  readonly pendingEdit?: BlastRadiusVM | undefined;
  readonly pendingRetire?: RetireConfirmVM | undefined;
  readonly pendingReset?: ResetConfirmVM | undefined;
  readonly pendingSetDefault?: SetDefaultConfirmVM | undefined;
};

type Openers = Pick<
  PlansActions,
  'onEdit' | 'onReset' | 'onRetire' | 'onSetDefault' | 'onSubmitForm'
>;

/** The overlay-opening handlers, extracted so the interactive host stays under
 *  the size cap. Each opens exactly one overlay from a clicked row; an edit
 *  submit chains into the blast-radius confirm. */
const overlayOpeners = (
  byId: (id: string) => PlanRow | undefined,
  setFlow: Dispatch<SetStateAction<Flow>>,
): Openers => ({
  onEdit: (id) => {
    const p = byId(id);
    if (p)
      setFlow({
        form: {
          mode: 'edit',
          planId: id,
          draft: draftFromPlan(p),
          subscribers: p.subscribers,
        },
      });
  },
  onReset: (id) => {
    const p = byId(id);
    if (p)
      setFlow({
        pendingReset: {
          planId: id,
          displayName: p.displayName,
          subscribers: p.subscribers,
        },
      });
  },
  onRetire: (id) => {
    const p = byId(id);
    if (p)
      setFlow({
        pendingRetire: {
          planId: id,
          displayName: p.displayName,
          subscribers: p.subscribers,
        },
      });
  },
  onSetDefault: (id) => {
    const p = byId(id);
    const current = plansVM.plans.find((x) => x.isDefault);
    if (p)
      setFlow({
        pendingSetDefault: {
          planId: id,
          displayName: p.displayName,
          currentDefaultName: current?.displayName ?? null,
        },
      });
  },
  onSubmitForm: (draft) =>
    setFlow((f) =>
      f.form?.mode === 'edit'
        ? { pendingEdit: demoBlast(byId(f.form.planId ?? ''), draft) }
        : {},
    ),
});

/**
 * Interactive host: state lives in the story, the view stays pure. Create /
 * Edit open the form; an edit submit chains into the blast-radius confirm;
 * Retire / Reset / Set-default open their confirms; Cancel/X/Confirm all close.
 */
const FlowHost = ({ initial }: { readonly initial: Flow }) => {
  const [flow, setFlow] = useState<Flow>(initial);
  const byId = (id: string) => plansVM.plans.find((p) => p.planId === id);
  const closed = () => setFlow({});
  return (
    <DashboardShell active="Plans">
      <PlansView
        vm={{ ...plansVM, ...flow }}
        onCreate={() =>
          setFlow({ form: { mode: 'create', planId: null, draft: emptyDraft } })
        }
        {...overlayOpeners(byId, setFlow)}
        onConfirmSetDefault={closed}
        onCancelSetDefault={closed}
        onCancelForm={closed}
        onConfirmEdit={closed}
        onCancelEdit={closed}
        onConfirmRetire={closed}
        onCancelRetire={closed}
        onConfirmReset={closed}
        onCancelReset={closed}
      />
    </DashboardShell>
  );
};

/** Staff with `plans.manage`: full catalog — hidden legacy/custom plans and a retired promo. */
export const Populated: Story = { render: inShell(plansVM) };
export const Loading: Story = { render: inShell(loadingVM) };
export const ErrorState: Story = { render: inShell(errorVM) };
/** The blast-radius confirm gate (mandatory reason) — row ⋯ → Edit re-enters the flow. */
export const BlastRadiusConfirm: Story = {
  render: () => (
    <FlowHost initial={{ pendingEdit: blastRadiusVM.pendingEdit }} />
  ),
};
/** "Create plan" open on a blank draft — submit/Cancel/X return to the catalog. */
export const CreatePlan: Story = {
  render: () => <FlowHost initial={{ form: formCreateVM.form }} />,
};
/** The full edit chain: form (key read-only) → Continue → blast-radius → Confirm. */
export const EditPlanFlow: Story = {
  render: () => <FlowHost initial={{ form: formEditVM.form }} />,
};
/** Retiring the hidden legacy plan — destructive confirm, subscribers keep it. */
export const RetireConfirm: Story = {
  render: () => (
    <FlowHost initial={{ pendingRetire: retireVM.pendingRetire }} />
  ),
};
/** Reset a plan to its code floor — reason-gated, a mass live-edit; the domain
 *  rejects a reset on a plan with no code seed (row ⋯ → Reset to defaults). */
export const ResetConfirm: Story = {
  render: () => <FlowHost initial={{ pendingReset: resetVM.pendingReset }} />,
};
/** Make a plan the default for new orgs — reason-gated; existing orgs unaffected.
 *  Only active + public non-default plans offer it (row ⋯ → Set as default). */
export const SetDefaultConfirm: Story = {
  render: () => (
    <FlowHost initial={{ pendingSetDefault: setDefaultVM.pendingSetDefault }} />
  ),
};
/** A role without `plans.manage` — catalog readable, no create/edit levers. */
export const ReadOnly: Story = {
  render: inShell({ ...plansVM, canManage: false }),
};
