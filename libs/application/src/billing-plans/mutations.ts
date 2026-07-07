import { type Result, err, ok } from '@acme/shared';
import {
  createPlan as createPlanEntity,
  findPlanSeed,
  markDefault,
  resetPlanFromSeed,
  retirePlan as retirePlanEntity,
  updatePlan as updatePlanEntity,
} from '@acme/domain';
import type {
  AccessActor,
  CreatePlanInput,
  Plan,
  PlanChanges,
} from '@acme/domain';
import { authorizePlansManage, beginPlanMutation, guardReason } from './deps';
import type { BillingPlansDeps } from './deps';
import {
  planConcurrentlyModified,
  planKeyTaken,
  planSeedMissing,
} from './errors';
import type { BillingPlansUseCaseError } from './errors';

type PlanResult = Promise<Result<Plan, BillingPlansUseCaseError>>;

const concurrentlyModified = (planId: string) =>
  planConcurrentlyModified(
    `Plan ${planId} was concurrently modified; reload and retry.`,
  );

/**
 * Register a new plan in the catalog. The key pre-check gives the friendly
 * error; the `unique(key)` constraint behind `savePlan` decides races — a
 * `'conflict'` on create IS a key collision, mapped to the same tag.
 */
export const makeCreatePlan =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly input: CreatePlanInput;
    readonly reason: string;
  }): PlanResult => {
    const now = deps.clock.now().toISOString();
    const authorized = authorizePlansManage(input.actor, now);
    if (!authorized.ok) return err(authorized.error);
    const reason = guardReason(input.reason);
    if (!reason.ok) return err(reason.error);

    const taken = () =>
      planKeyTaken(`Plan key "${input.input.key}" is already taken.`);
    if (await deps.plans.findPlanByKey(input.input.key)) return err(taken());

    const plan = createPlanEntity(input.input, {
      ids: () => deps.ids.next(),
      now,
    });
    if (!plan.ok) return err(plan.error);

    const saved = await deps.plans.savePlan(plan.value, null, {
      type: 'plan.created',
      plan: plan.value,
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    });
    if (saved === 'conflict') return err(taken());
    return ok(plan.value);
  };

/**
 * The live mass-edit (ADR-0016 D3): entitlement changes propagate to every
 * subscriber, so the write is CAS-guarded by the version the STAFF SAW
 * (`expectedVersion`) and audited with the full before/after terms — the only
 * place the old commercial terms survive (the legacy-plan playbook reads it).
 */
export const makeUpdatePlan =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly planId: string;
    readonly changes: PlanChanges;
    readonly expectedVersion: number;
    readonly reason: string;
  }): PlanResult => {
    const begun = await beginPlanMutation(deps, input);
    if (!begun.ok) return err(begun.error);
    const { plan, reason, now } = begun.value;

    const next = updatePlanEntity(plan, input.changes, now);
    if (!next.ok) return err(next.error);

    const saved = await deps.plans.savePlan(next.value, input.expectedVersion, {
      type: 'plan.updated',
      planId: plan.id,
      before: plan,
      after: next.value,
      actorMembershipId: input.actor.membership.id,
      reason,
      occurredAt: now,
    });
    if (saved === 'conflict') return err(concurrentlyModified(input.planId));
    return ok(next.value);
  };

/**
 * Retire, never delete (ADR-0016). The domain guards protect the default plan
 * and reject double retirement; CAS at the version just loaded closes the
 * race with a concurrent staff edit.
 */
export const makeRetirePlan =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly planId: string;
    readonly reason: string;
  }): PlanResult => {
    const begun = await beginPlanMutation(deps, input);
    if (!begun.ok) return err(begun.error);
    const { plan, reason, now } = begun.value;

    const retired = retirePlanEntity(plan);
    if (!retired.ok) return err(retired.error);

    const saved = await deps.plans.savePlan(retired.value, plan.version, {
      type: 'plan.retired',
      planId: plan.id,
      actorMembershipId: input.actor.membership.id,
      reason,
      occurredAt: now,
    });
    if (saved === 'conflict') return err(concurrentlyModified(input.planId));
    return ok(retired.value);
  };

/**
 * Restore a live plan to its code floor. A reset is a mass live-edit in
 * disguise (ADR-0016), so it carries the same before/after audit payload and
 * the same CAS gate as `updatePlan` — anchored at the version just loaded.
 */
export const makeResetPlan =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly planId: string;
    readonly reason: string;
  }): PlanResult => {
    const begun = await beginPlanMutation(deps, input);
    if (!begun.ok) return err(begun.error);
    const { plan, reason, now } = begun.value;

    const seed = findPlanSeed(plan.key);
    if (!seed) {
      return err(
        planSeedMissing(`Plan "${plan.key}" has no code seed to reset to.`),
      );
    }
    const next = resetPlanFromSeed(plan, seed, now);
    if (!next.ok) return err(next.error);

    const saved = await deps.plans.savePlan(next.value, plan.version, {
      type: 'plan.reset',
      planId: plan.id,
      before: plan,
      after: next.value,
      actorMembershipId: input.actor.membership.id,
      reason,
      occurredAt: now,
    });
    if (saved === 'conflict') return err(concurrentlyModified(input.planId));
    return ok(next.value);
  };

/**
 * Move the singular default-for-new-orgs marker. The domain guard rejects
 * retired/hidden targets (`domain/plan-not-assignable`); the store moves the
 * marker atomically with the `billing.default-plan-changed` audit event. The
 * reason is demanded (staff lever) even though this event only records the
 * from→to move.
 */
export const makeSetDefaultPlan =
  (deps: BillingPlansDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly planId: string;
    readonly reason: string;
  }): Promise<Result<void, BillingPlansUseCaseError>> => {
    const begun = await beginPlanMutation(deps, input);
    if (!begun.ok) return err(begun.error);
    const { plan, now } = begun.value;

    const marked = markDefault(plan);
    if (!marked.ok) return err(marked.error);

    const current = await deps.plans.findDefaultPlan();
    await deps.plans.setDefaultPlan(plan.id, {
      type: 'billing.default-plan-changed',
      fromPlanId: current?.id ?? null,
      toPlanId: plan.id,
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    });
    return ok(undefined);
  };
