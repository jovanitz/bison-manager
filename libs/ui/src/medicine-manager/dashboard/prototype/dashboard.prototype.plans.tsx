/**
 * Interactive PLANS prototype — create / edit (review gate) / retire, each
 * wired to a SIMULATED backend so the loading + success + error flows are real
 * to click through (logic in dashboard.prototype.plans.logic). The "Simulate"
 * toggle picks the next outcome — prototype-only scaffolding, not the real
 * screen. Views stay pure (fn of VM + actions); the state lives here.
 */
import { useState } from 'react';
import { PlansView } from '../plans/plans.view';
import { Stack } from '../../../design-system/stack/stack';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../design-system/toggle-group/toggle-group';
import { demoBlast, emptyDraft, plansVM } from '../plans/plans.fixtures';
import type {
  PlanDraft,
  PlanFormVM,
  RetireConfirmVM,
} from '../plans/plans.types';
import {
  buildConfirmEdit,
  buildConfirmRetire,
  buildCreate,
  rowActions,
  type Outcome,
  type PendingEdit,
} from './dashboard.prototype.plans.logic';

/** Prototype-only control to pick the next simulated backend outcome. */
const OutcomeToggle = (p: {
  readonly value: Outcome;
  readonly onChange: (v: Outcome) => void;
}) => (
  <label className="flex items-center gap-3 text-xs text-muted-foreground">
    Simulate backend
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={p.value}
      onValueChange={(v) => v && p.onChange(v as Outcome)}
    >
      <ToggleGroupItem value="success">Success</ToggleGroupItem>
      <ToggleGroupItem value="error">Error</ToggleGroupItem>
    </ToggleGroup>
  </label>
);

export const PlansSection = () => {
  const [plans, setPlans] = useState(plansVM.plans);
  const [form, setForm] = useState<PlanFormVM | undefined>(undefined);
  const [pending, setPending] = useState<PendingEdit | undefined>(undefined);
  const [retire, setRetire] = useState<RetireConfirmVM | undefined>(undefined);
  const [outcome, setOutcome] = useState<Outcome>('success');
  const fail = outcome === 'error';
  const byId = (id: string) => plans.find((p) => p.planId === id);
  const create = buildCreate(fail, setForm, setPlans);

  const submitForm = (draft: PlanDraft) => {
    if (form?.mode !== 'edit' || !form.planId) return void create(draft);
    setPending({
      planId: form.planId,
      draft,
      blast: demoBlast(byId(form.planId), draft),
    });
    setForm(undefined);
  };

  return (
    <Stack gap="group">
      <OutcomeToggle value={outcome} onChange={setOutcome} />
      <PlansView
        vm={{
          ...plansVM,
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
        onConfirmEdit={() =>
          pending &&
          void buildConfirmEdit(fail, pending, setPending, setPlans)()
        }
        onCancelEdit={() => setPending(undefined)}
        onConfirmRetire={() =>
          retire && void buildConfirmRetire(fail, retire, setRetire, setPlans)()
        }
        onCancelRetire={() => setRetire(undefined)}
      />
    </Stack>
  );
};
