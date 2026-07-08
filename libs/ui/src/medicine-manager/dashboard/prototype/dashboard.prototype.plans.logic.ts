/**
 * State logic for the interactive Plans prototype (dashboard.prototype.plans).
 * Simulates a backend: each action flips a busy flag, waits, then applies the
 * mutation with a success toast or surfaces an inline error + a toast. Kept out
 * of the .tsx to stay under the size caps; no JSX lives here.
 */
import { type Dispatch, type SetStateAction } from 'react';
import { toast } from '../../../design-system/toast/toaster';
import { demoBlast, draftFromPlan } from '../plans/plans.fixtures';
import type {
  BlastRadiusVM,
  PlanDraft,
  PlanFormVM,
  PlanRow,
  RetireConfirmVM,
} from '../plans/plans.types';

export type Outcome = 'success' | 'error';
type Plans = readonly PlanRow[];
type SetPlans = Dispatch<SetStateAction<Plans>>;
type SetForm = Dispatch<SetStateAction<PlanFormVM | undefined>>;
type SetPending = Dispatch<SetStateAction<PendingEdit | undefined>>;
type SetRetire = Dispatch<SetStateAction<RetireConfirmVM | undefined>>;

const wait = () => new Promise<void>((res) => setTimeout(res, 900));
const FAIL = 'The billing service didn’t respond. Please try again.';

/** An edit held at the review gate — the draft applies on confirm. */
export type PendingEdit = {
  readonly planId: string;
  readonly draft: PlanDraft;
  readonly blast: BlastRadiusVM;
};

const createdRow = (plans: Plans, draft: PlanDraft): PlanRow => ({
  ...draft,
  planId: `plan_new_${plans.length + 1}`,
  status: 'active',
  isDefault: false,
  subscribers: 0,
});

// Pure catalog updaters — keep the setState callbacks flat (no nested maps).
const withCreated = (plans: Plans, draft: PlanDraft): Plans => [
  ...plans,
  createdRow(plans, draft),
];
const withEdited = (plans: Plans, id: string, draft: PlanDraft): Plans =>
  plans.map((p) => (p.planId === id ? { ...p, ...draft } : p));
const withRetired = (plans: Plans, id: string): Plans =>
  plans.map((p) => (p.planId === id ? { ...p, status: 'retired' } : p));

/** The loading → wait → (apply + success) | (inline error + toast) pattern. */
const runAction = async (o: {
  readonly fail: boolean;
  readonly setBusy: (busy: boolean, error?: string) => void;
  readonly apply: () => void;
  readonly toastOk: string;
  readonly toastFail: string;
  readonly done: () => void;
}) => {
  o.setBusy(true);
  await wait();
  if (o.fail) {
    o.setBusy(false, FAIL);
    toast.error(o.toastFail);
    return;
  }
  o.apply();
  toast.success(o.toastOk);
  o.done();
};

/** Row-menu handlers (Edit / Reset / Retire). */
export const rowActions = (deps: {
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
    deps.setPending({ planId: id, draft, blast: demoBlast(p, draft) });
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

export const buildCreate =
  (fail: boolean, setForm: SetForm, setPlans: SetPlans) => (draft: PlanDraft) =>
    runAction({
      fail,
      setBusy: (b, e) => setForm((f) => f && { ...f, submitting: b, error: e }),
      apply: () => setPlans((prev) => withCreated(prev, draft)),
      toastOk: `Plan “${draft.displayName}” created`,
      toastFail: 'Could not create plan',
      done: () => setForm(undefined),
    });

export const buildConfirmEdit =
  (
    fail: boolean,
    edit: PendingEdit,
    setPending: SetPending,
    setPlans: SetPlans,
  ) =>
  () =>
    runAction({
      fail,
      setBusy: (b, e) =>
        setPending(
          (p) => p && { ...p, blast: { ...p.blast, confirming: b, error: e } },
        ),
      apply: () =>
        setPlans((prev) => withEdited(prev, edit.planId, edit.draft)),
      toastOk: 'Changes applied',
      toastFail: 'Could not apply changes',
      done: () => setPending(undefined),
    });

export const buildConfirmRetire =
  (
    fail: boolean,
    r: RetireConfirmVM,
    setRetire: SetRetire,
    setPlans: SetPlans,
  ) =>
  () =>
    runAction({
      fail,
      setBusy: (b, e) => setRetire((x) => x && { ...x, retiring: b, error: e }),
      apply: () => setPlans((prev) => withRetired(prev, r.planId)),
      toastOk: `“${r.displayName}” retired`,
      toastFail: 'Could not retire plan',
      done: () => setRetire(undefined),
    });
