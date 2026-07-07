import { type Result, err, ok } from '@acme/shared';
import { updatePlan as updatePlanEntity } from '@acme/domain';
import type { AccessActor, Plan, PlanChanges } from '@acme/domain';
import { authorizePlansManage } from './deps';
import type { BillingPlansDeps } from './deps';
import {
  makeCreatePlan,
  makeResetPlan,
  makeRetirePlan,
  makeSetDefaultPlan,
  makeUpdatePlan,
} from './mutations';
import { planNotFound } from './errors';
import type { BillingPlansUseCaseError } from './errors';
import type { PlanImpactPreview, PlanSubscriberEntry } from './ports';

export type { BillingPlansDeps } from './deps';

/**
 * The FULL catalog — hidden and retired included. Staff-only by permission
 * (`plans.manage`, owner preset in v1): hidden plan names encode who got
 * special terms, so the list never reaches customers (ADR-0016).
 */
export const makeListPlans =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
  }): Promise<Result<readonly Plan[], BillingPlansUseCaseError>> => {
    const authorized = authorizePlansManage(
      input.actor,
      deps.clock.now().toISOString(),
    );
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.plans.listPlans());
  };

/**
 * The blast-radius instrument (ADR-0016, hard precondition of live
 * propagation): apply the staff's changes PURELY — never saved — and report
 * how many subscribers the commit would touch. Staff confirm against this
 * BEFORE `updatePlan` commits the live edit.
 */
export const makePreviewPlanUpdate =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly planId: string;
    readonly changes: PlanChanges;
  }): Promise<Result<PlanImpactPreview, BillingPlansUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const authorized = authorizePlansManage(input.actor, now);
    if (!authorized.ok) return err(authorized.error);

    const plan = await deps.plans.findPlanById(input.planId);
    if (!plan) return err(planNotFound(`No plan ${input.planId}.`));

    const next = updatePlanEntity(plan, input.changes, now);
    if (!next.ok) return err(next.error);

    const impact = await deps.plans.previewImpact(
      plan.id,
      next.value.entitlements,
    );
    const subscribers = await deps.plans.countSubscribers(plan.id);
    return ok({ subscribers, ...impact });
  };

/** The `plans.subscribers` staff instrument: which orgs, since when — the
 * minimum visibility for edits, appeasement and cleanup (ADR-0016). */
export const makeListPlanSubscribers =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly planId: string;
  }): Promise<
    Result<readonly PlanSubscriberEntry[], BillingPlansUseCaseError>
  > => {
    const authorized = authorizePlansManage(
      input.actor,
      deps.clock.now().toISOString(),
    );
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.plans.listSubscribers(input.planId));
  };

export {
  makeCreatePlan,
  makeResetPlan,
  makeRetirePlan,
  makeSetDefaultPlan,
  makeUpdatePlan,
};

export type BillingPlansUseCases = {
  readonly listPlans: ReturnType<typeof makeListPlans>;
  readonly previewPlanUpdate: ReturnType<typeof makePreviewPlanUpdate>;
  readonly createPlan: ReturnType<typeof makeCreatePlan>;
  readonly updatePlan: ReturnType<typeof makeUpdatePlan>;
  readonly retirePlan: ReturnType<typeof makeRetirePlan>;
  readonly resetPlan: ReturnType<typeof makeResetPlan>;
  readonly setDefaultPlan: ReturnType<typeof makeSetDefaultPlan>;
  readonly listSubscribers: ReturnType<typeof makeListPlanSubscribers>;
};

export const makeBillingPlansUseCases = (
  deps: BillingPlansDeps,
): BillingPlansUseCases => ({
  listPlans: makeListPlans(deps),
  previewPlanUpdate: makePreviewPlanUpdate(deps),
  createPlan: makeCreatePlan(deps),
  updatePlan: makeUpdatePlan(deps),
  retirePlan: makeRetirePlan(deps),
  resetPlan: makeResetPlan(deps),
  setDefaultPlan: makeSetDefaultPlan(deps),
  listSubscribers: makeListPlanSubscribers(deps),
});
