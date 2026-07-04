/**
 * Interactive PROTOTYPE sections — flow simulations with local fixture state
 * and no real logic. The views stay pure (`fn(vm + actions)`); every mutation
 * here only rewrites local state so the click-through feels real: creating a
 * plan appends a row, retiring flips the badge, mark-paid revives a past_due
 * org. dashboard.prototype.tsx stitches these into the shell.
 */
import { useState } from 'react';
import { PlansView } from '../plans/plans.view';
import { OrgDetailView } from '../org-detail/org-detail.view';
import { draftFromPlan, emptyDraft } from '../plans/plans.fixtures';
import type {
  BlastRadiusVM,
  PlanDraft,
  PlanFormVM,
  PlanRow,
  RetireConfirmVM,
} from '../plans/plans.types';
import type {
  BillingDialogVM,
  OrgSubscriptionVM,
} from '../org-detail/org-detail.types';
import * as fx from './dashboard.prototype.fixtures';

const noop = () => undefined;

/** An edit held at the blast-radius gate — the draft applies on confirm. */
type PendingEdit = {
  readonly planId: string;
  readonly draft: PlanDraft;
  readonly blast: BlastRadiusVM;
};

const blastFor = (
  plan: PlanRow | undefined,
  draft: PlanDraft,
): BlastRadiusVM => ({
  planName: draft.displayName,
  subscribers: plan?.subscribers ?? 0,
  wouldGoOverLimit: 4,
  wouldLoseFeature: 2,
});

const createdRow = (plans: readonly PlanRow[], draft: PlanDraft): PlanRow => ({
  ...draft,
  planId: `plan_new_${plans.length + 1}`,
  status: 'active',
  isDefault: false,
  subscribers: 0,
});

/** Row-menu handlers, extracted so the component stays inside the size caps. */
const rowActions = (deps: {
  readonly byId: (id: string) => PlanRow | undefined;
  readonly setForm: (f: PlanFormVM) => void;
  readonly setPending: (p: PendingEdit) => void;
  readonly setRetire: (r: RetireConfirmVM) => void;
}) => ({
  onEdit: (id: string) => {
    const p = deps.byId(id);
    if (p)
      deps.setForm({
        mode: 'edit',
        planId: id,
        draft: draftFromPlan(p),
        subscribers: p.subscribers,
      });
  },
  onReset: (id: string) => {
    const p = deps.byId(id);
    if (!p) return;
    const draft = draftFromPlan(p);
    deps.setPending({
      planId: id,
      draft,
      blast: {
        ...blastFor(p, draft),
        wouldGoOverLimit: 0,
        wouldLoseFeature: 0,
      },
    });
  },
  onRetire: (id: string) => {
    const p = deps.byId(id);
    if (p)
      deps.setRetire({
        planId: id,
        displayName: p.displayName,
        subscribers: p.subscribers,
      });
  },
});

export const PlansSection = () => {
  const [plans, setPlans] = useState(fx.plansVM.plans);
  const [form, setForm] = useState<PlanFormVM | undefined>(undefined);
  const [pending, setPending] = useState<PendingEdit | undefined>(undefined);
  const [retire, setRetire] = useState<RetireConfirmVM | undefined>(undefined);
  const byId = (id: string) => plans.find((p) => p.planId === id);
  const submitForm = (draft: PlanDraft) => {
    if (form?.mode === 'edit' && form.planId) {
      const id = form.planId;
      setPending({ planId: id, draft, blast: blastFor(byId(id), draft) });
    } else {
      setPlans([...plans, createdRow(plans, draft)]);
    }
    setForm(undefined);
  };
  const confirmEdit = () => {
    if (pending)
      setPlans(
        plans.map((p) =>
          p.planId === pending.planId ? { ...p, ...pending.draft } : p,
        ),
      );
    setPending(undefined);
  };
  const confirmRetire = () => {
    if (retire)
      setPlans(
        plans.map((p) =>
          p.planId === retire.planId ? { ...p, status: 'retired' } : p,
        ),
      );
    setRetire(undefined);
  };
  return (
    <PlansView
      vm={{
        ...fx.plansVM,
        plans,
        form,
        pendingEdit: pending?.blast,
        pendingRetire: retire,
      }}
      onCreate={() =>
        setForm({ mode: 'create', planId: null, draft: emptyDraft })
      }
      {...rowActions({ byId, setForm, setPending, setRetire })}
      onSubmitForm={submitForm}
      onCancelForm={() => setForm(undefined)}
      onConfirmEdit={confirmEdit}
      onCancelEdit={() => setPending(undefined)}
      onConfirmRetire={confirmRetire}
      onCancelRetire={() => setRetire(undefined)}
    />
  );
};

export const OrgDetailSection = ({
  accountId,
  name,
  onBack,
}: {
  readonly accountId: string;
  readonly name: string;
  readonly onBack: () => void;
}) => {
  const [sub, setSub] = useState(fx.orgDetailVM.subscription);
  const [dialog, setDialog] = useState<BillingDialogVM | undefined>(undefined);
  const close = () => setDialog(undefined);
  const patch = (p: Partial<OrgSubscriptionVM>) =>
    setSub((s) => (s ? { ...s, ...p } : s));
  return (
    <OrgDetailView
      vm={{
        ...fx.orgDetailVM,
        accountId,
        name,
        subscription: sub,
        billingDialog: dialog,
      }}
      onBack={onBack}
      onImpersonate={noop}
      onMarkPaid={() => setDialog({ kind: 'mark-paid' })}
      onExtendTrial={() => setDialog({ kind: 'extend-trial' })}
      onChangePlan={() =>
        setDialog({ kind: 'change-plan', options: fx.changePlanOptions })
      }
      onCloseBillingDialog={close}
      onSubmitMarkPaid={(paidThrough) => {
        patch({ paidThroughAt: paidThrough, phase: 'active' });
        close();
      }}
      onSubmitExtendTrial={(trialEndsAt) => {
        patch({ trialEndsAt, phase: 'trialing' });
        close();
      }}
      onSubmitChangePlan={(planId) => {
        const target = fx.changePlanOptions.find((o) => o.planId === planId);
        if (target)
          patch({ planName: target.label, priceLabel: target.priceLabel });
        close();
      }}
    />
  );
};
