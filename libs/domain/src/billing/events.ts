import type { PlanEntitlements } from './entitlements';
import type { Plan, PlanId } from './plan/plan';
import type { SubscriptionId } from './subscription/subscription';

/**
 * Billing audit events (ADR-0016). During the manual-billing era the audit
 * trail IS the accounting, so writes accept the matching event and persist
 * mutation + audit record in one transaction — an unaudited staff lever is
 * unrepresentable. Plan edits carry FULL before/after payloads: they are the
 * only place old commercial terms survive (the legacy-plan playbook reads
 * them). Actor ids are plain strings — billing does not import access brands.
 */
export type BillingPlanCreated = {
  readonly type: 'plan.created';
  readonly plan: Plan;
  readonly actorMembershipId: string;
  readonly occurredAt: string;
};

export type BillingPlanUpdated = {
  readonly type: 'plan.updated';
  readonly planId: PlanId;
  readonly before: Plan;
  readonly after: Plan;
  readonly actorMembershipId: string;
  readonly reason: string;
  readonly occurredAt: string;
};

export type BillingPlanRetired = {
  readonly type: 'plan.retired';
  readonly planId: PlanId;
  readonly actorMembershipId: string;
  readonly reason: string;
  readonly occurredAt: string;
};

/** Reset to the code floor — a mass live-edit; same payload rules as update. */
export type BillingPlanReset = {
  readonly type: 'plan.reset';
  readonly planId: PlanId;
  readonly before: Plan;
  readonly after: Plan;
  readonly actorMembershipId: string;
  readonly reason: string;
  readonly occurredAt: string;
};

export type BillingDefaultPlanChanged = {
  readonly type: 'billing.default-plan-changed';
  readonly fromPlanId: PlanId | null;
  readonly toPlanId: PlanId;
  readonly actorMembershipId: string;
  readonly occurredAt: string;
};

export type BillingSubscriptionStarted = {
  readonly type: 'subscription.started';
  readonly subscriptionId: SubscriptionId;
  readonly accountId: string;
  readonly planId: PlanId;
  readonly createdByUserId: string;
  readonly trialEndsAt: string;
  readonly occurredAt: string;
};

export type BillingSubscriptionPlanChanged = {
  readonly type: 'subscription.plan-changed';
  readonly subscriptionId: SubscriptionId;
  readonly accountId: string;
  readonly fromPlanId: PlanId;
  readonly toPlanId: PlanId;
  readonly actorMembershipId: string;
  readonly reason: string;
  readonly occurredAt: string;
};

/** `amountNote` is the manual-era answer to "what did we collect?". */
export type BillingSubscriptionPaidMarked = {
  readonly type: 'subscription.paid-marked';
  readonly subscriptionId: SubscriptionId;
  readonly accountId: string;
  readonly paidThroughAt: string;
  readonly amountNote: string | null;
  readonly actorMembershipId: string;
  readonly reason: string;
  readonly occurredAt: string;
};

export type BillingSubscriptionTrialExtended = {
  readonly type: 'subscription.trial-extended';
  readonly subscriptionId: SubscriptionId;
  readonly accountId: string;
  readonly trialEndsAt: string;
  readonly actorMembershipId: string;
  readonly reason: string;
  readonly occurredAt: string;
};

/** Lazily observed (no actor); the recording write must be CAS-guarded so
 * concurrent observers emit ONE event, not N (the `grant.expired` precedent). */
export type BillingSubscriptionTrialExpired = {
  readonly type: 'subscription.trial-expired';
  readonly subscriptionId: SubscriptionId;
  readonly accountId: string;
  readonly trialEndsAt: string;
  readonly occurredAt: string;
};

export type BillingSubscriptionOverrideSet = {
  readonly type: 'subscription.override-set';
  readonly subscriptionId: SubscriptionId;
  readonly accountId: string;
  readonly before: Partial<PlanEntitlements> | null;
  readonly after: Partial<PlanEntitlements> | null;
  readonly actorMembershipId: string;
  readonly reason: string;
  readonly occurredAt: string;
};

export type BillingEvent =
  | BillingPlanCreated
  | BillingPlanUpdated
  | BillingPlanRetired
  | BillingPlanReset
  | BillingDefaultPlanChanged
  | BillingSubscriptionStarted
  | BillingSubscriptionPlanChanged
  | BillingSubscriptionPaidMarked
  | BillingSubscriptionTrialExtended
  | BillingSubscriptionTrialExpired
  | BillingSubscriptionOverrideSet;

export type BillingEventType = BillingEvent['type'];

/** Runtime catalogue of the union above (kept exhaustive by the check below). */
export const BILLING_EVENT_TYPES = [
  'plan.created',
  'plan.updated',
  'plan.retired',
  'plan.reset',
  'billing.default-plan-changed',
  'subscription.started',
  'subscription.plan-changed',
  'subscription.paid-marked',
  'subscription.trial-extended',
  'subscription.trial-expired',
  'subscription.override-set',
] as const satisfies ReadonlyArray<BillingEventType>;

type MissingBillingEventType = Exclude<
  BillingEventType,
  (typeof BILLING_EVENT_TYPES)[number]
>;
// Compile-time exhaustiveness: adding an event type without listing it here
// turns `MissingBillingEventType` non-never and this line stops compiling.
const billingEventTypesAreExhaustive: MissingBillingEventType extends never
  ? true
  : never = true;
void billingEventTypesAreExhaustive;
