import {
  type Clock,
  type IdGenerator,
  type Result,
  err,
  ok,
} from '@acme/shared';
import type { AccessActor, Plan } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { planNotFound, reasonRequired } from './errors';
import type { BillingPlansUseCaseError } from './errors';
import type { PlanCatalogStore } from './ports';

/**
 * Shared dependency set of the billing-plans use cases. Lives apart from the
 * factories so `use-cases.ts` and `mutations.ts` both depend on it without
 * depending on each other (the access-admin/deps precedent).
 */
export type BillingPlansDeps = {
  readonly plans: PlanCatalogStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

// Administering the catalog is a platform-staff operation: authorize
// `plans.manage` against the platform scope (accountId null → needs `any`;
// the owner preset only, in v1 — ADR-0016). Denial is the same generic
// `app/access-denied` as every other refusal.
export const authorizePlansManage = (actor: AccessActor, now: string) =>
  authorizeAccessAction({
    actor,
    action: 'plans.manage',
    resource: { accountId: null },
    now,
  });

/**
 * Staff-lever mutations demand a non-empty reason (the impersonation-grant
 * precedent): a reasonless lever is invisible misuse, and plan audit events
 * are the only place old commercial terms survive. Returns the trimmed reason.
 */
export const guardReason = (
  raw: string,
): Result<string, BillingPlansUseCaseError> => {
  const reason = raw.trim();
  if (reason.length === 0) {
    return err(reasonRequired('A plan mutation requires a non-empty reason.'));
  }
  return ok(reason);
};

/** Shared head of every plan mutation: authorize, demand a reason, load. */
export const beginPlanMutation = async (
  deps: BillingPlansDeps,
  input: {
    readonly actor: AccessActor;
    readonly planId: string;
    readonly reason: string;
  },
): Promise<
  Result<
    { readonly plan: Plan; readonly reason: string; readonly now: string },
    BillingPlansUseCaseError
  >
> => {
  const now = deps.clock.now().toISOString();
  const authorized = authorizePlansManage(input.actor, now);
  if (!authorized.ok) return err(authorized.error);
  const reason = guardReason(input.reason);
  if (!reason.ok) return err(reason.error);
  const plan = await deps.plans.findPlanById(input.planId);
  if (!plan) return err(planNotFound(`No plan ${input.planId}.`));
  return ok({ plan, reason: reason.value, now });
};
