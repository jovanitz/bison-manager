import { fixedClock, type Result } from '@acme/shared';
import type {
  BillingEvent,
  Plan,
  PlanId,
  Subscription,
  SubscriptionId,
} from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makeEntitlementGuards } from './guards';
import type { BillingAccountRef } from './ports';
import { makeBillingSubscriptionsUseCases } from './use-cases';

/**
 * Spec fixtures for the billing-subscriptions module. Test-only by convention
 * (imported from `*.spec.ts`), kept here so the guard, summary and lever
 * specs all build the same in-memory billing world — no infra imports.
 */
export const ORG = 'org-1';

/** Clock for the GUARD specs; `pastDueSubscription` is `past_due` at it. */
export const GUARDS_NOW = '2026-07-04T12:00:00.000Z';

export const staff = testAccessActor({ preset: 'owner' });
export const support = testAccessActor({ preset: 'support' });
export const orgAdmin = testAccessActor({
  preset: 'customer-admin',
  accountId: ORG,
});

export const CUSTOMER: BillingAccountRef = { accountId: ORG, kind: 'customer' };
export const STAFF: BillingAccountRef = {
  accountId: 'org-staff',
  kind: 'staff',
};

export const freePlan = (over?: Partial<Plan>): Plan => ({
  id: 'plan-free' as PlanId,
  key: 'free',
  displayName: 'Free',
  internalNote: 'Code floor.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: true,
  entitlements: {
    limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
    features: ['export.csv'],
  },
  trialMonths: 3,
  price: null,
  priceSetAt: null,
  version: 1,
  ...over,
});

/** Retired = frozen, closed to ALL new subscriptions — even staff. */
export const RETIRED_PLAN = freePlan({
  id: 'plan-legacy' as PlanId,
  key: 'legacy',
  status: 'retired',
  isDefaultForNewOrgs: false,
});

/** Hidden + active = staff-assignable (the home of legacy/custom plans). */
export const HIDDEN_PLAN = freePlan({
  id: 'plan-custom' as PlanId,
  key: 'custom',
  displayName: 'Pro',
  visibility: 'hidden',
  isDefaultForNewOrgs: false,
});

/** Default facts put the subscription in `trialing` at TEST_ACCESS_NOW. */
export const subscription = (over?: Partial<Subscription>): Subscription => ({
  id: 'sub-1' as SubscriptionId,
  accountId: ORG,
  planId: 'plan-free' as PlanId,
  createdByUserId: 'user-1',
  startedAt: '2026-06-01T00:00:00.000Z',
  trialEndsAt: '2026-09-01T00:00:00.000Z',
  paidThroughAt: null,
  canceledAt: null,
  overrides: null,
  ...over,
});

/** Same facts shifted back: `past_due` at GUARDS_NOW (trial over, unpaid). */
export const pastDueSubscription = (
  over?: Partial<Subscription>,
): Subscription =>
  subscription({
    startedAt: '2026-01-01T00:00:00.000Z',
    trialEndsAt: '2026-04-01T00:00:00.000Z',
    ...over,
  });

/** The error tag of a failed Result, or null — assertions stay in the test. */
export const errTag = (
  result: Result<unknown, { tag: string }>,
): string | null => (result.ok ? null : result.error.tag);

/** One mutable subscription slot shared by both fake stores. */
const subscriptionCell = (initial: Subscription | null) => {
  let stored = initial;
  let finds = 0;
  const events: BillingEvent[] = [];
  return {
    events,
    finds: () => finds,
    current: () => stored,
    findByAccount: async (accountId: string) => {
      finds += 1;
      return stored && stored.accountId === accountId ? stored : null;
    },
    save: async (next: Subscription, event: BillingEvent) => {
      stored = next;
      events.push(event);
    },
  };
};

const findPlanIn =
  (plans: ReadonlyArray<Plan>) =>
  async (planId: string): Promise<Plan | null> =>
    plans.find((plan) => plan.id === planId) ?? null;

export type GuardsWorldInput = {
  readonly sub?: Subscription | null;
  readonly plans?: ReadonlyArray<Plan>;
  readonly members?: number;
  readonly ownedOrgs?: number;
};

/** In-memory fakes around the entitlement guards. */
export const makeGuardsWorld = (input?: GuardsWorldInput) => {
  const cell = subscriptionCell(
    input?.sub === undefined ? pastDueSubscription() : input.sub,
  );
  const plans = input?.plans ?? [freePlan()];
  const orgCountCalls: Array<{ userId: string; planKey: string }> = [];
  let recordCalls = 0;
  let expiredRecorded = false;

  const guards = makeEntitlementGuards({
    subscriptions: {
      findByAccount: cell.findByAccount,
      save: cell.save,
      hasTrialConsumedByUser: async () => false,
      recordTrialExpired: async (_id, event) => {
        recordCalls += 1;
        if (expiredRecorded) return false;
        expiredRecorded = true;
        cell.events.push(event);
        return true;
      },
    },
    plans: {
      findPlanById: findPlanIn(plans),
      findDefaultPlan: async () =>
        plans.find((plan) => plan.isDefaultForNewOrgs) ?? null,
    },
    usage: {
      countMembers: async () => input?.members ?? 0,
      countOwnedOrgsOnPlan: async (userId, planKey) => {
        orgCountCalls.push({ userId, planKey });
        return input?.ownedOrgs ?? 0;
      },
    },
    clock: fixedClock(new Date(GUARDS_NOW)),
    graceDays: 14,
  });

  return {
    guards,
    events: cell.events,
    orgCountCalls,
    finds: cell.finds,
    recordCalls: () => recordCalls,
  };
};

export type SubsWorldInput = {
  readonly sub?: Subscription | null;
  readonly plans?: ReadonlyArray<Plan>;
  readonly members?: number;
};

/** In-memory fakes around the subscription use cases. */
export const makeSubsWorld = (input?: SubsWorldInput) => {
  const cell = subscriptionCell(
    input?.sub === undefined ? subscription() : input.sub,
  );
  const plans = input?.plans ?? [freePlan(), RETIRED_PLAN, HIDDEN_PLAN];

  const useCases = makeBillingSubscriptionsUseCases({
    subscriptions: {
      findByAccount: cell.findByAccount,
      save: cell.save,
      hasTrialConsumedByUser: async () => false,
      recordTrialExpired: async () => false,
    },
    plans: { findPlanById: findPlanIn(plans) },
    usage: {
      countMembers: async () => input?.members ?? 0,
      countOwnedOrgsOnPlan: async () => 0,
    },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    graceDays: 14,
  });

  return {
    useCases,
    events: cell.events,
    current: cell.current,
    finds: cell.finds,
  };
};
