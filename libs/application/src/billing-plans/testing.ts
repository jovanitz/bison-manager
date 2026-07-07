import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import type { BillingEvent, CreatePlanInput, Plan, PlanId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makeBillingPlansUseCases } from './use-cases';
import type { PlanCatalogStore, PlanSubscriberEntry } from './ports';

/**
 * Spec fixtures for the billing-plans module. Test-only by convention
 * (imported from `*.spec.ts`), kept here so both plan specs build the same
 * catalog world.
 */
const plan = (over: Partial<Plan> & Pick<Plan, 'id' | 'key'>): Plan => ({
  displayName: 'A plan',
  internalNote: 'Fixture plan.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: false,
  entitlements: {
    limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
    features: [],
  },
  trialMonths: 3,
  price: null,
  priceSetAt: null,
  version: 1,
  ...over,
});

// The seeded free plan, DRIFTED by staff edits — the reset target.
export const FREE = plan({
  id: 'plan-free' as PlanId,
  key: 'free',
  displayName: 'Gratis (renegotiated)',
  trialMonths: 6,
  entitlements: {
    limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 25 },
    features: ['export.csv'],
  },
  isDefaultForNewOrgs: true,
  version: 4,
});
export const PRO = plan({
  id: 'plan-pro' as PlanId,
  key: 'pro',
  displayName: 'Pro',
  price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
  priceSetAt: TEST_ACCESS_NOW,
  version: 2,
});
export const LEGACY = plan({
  id: 'plan-legacy' as PlanId,
  key: 'legacy-pro',
  displayName: 'Pro',
  visibility: 'hidden',
});
export const RETIRED = plan({
  id: 'plan-old' as PlanId,
  key: 'old',
  status: 'retired',
});

export const SUBSCRIBERS: readonly PlanSubscriberEntry[] = [
  { accountId: 'org-11', since: '2026-05-01T00:00:00.000Z' },
  { accountId: 'org-12', since: '2026-06-01T00:00:00.000Z' },
];

export const CREATE_INPUT: CreatePlanInput = {
  key: 'team',
  displayName: 'Team',
  internalNote: 'Mid tier for small clinics.',
  visibility: 'public',
  entitlements: {
    limits: { maxOrganizationsOwned: 3, maxMembersPerOrg: 10 },
    features: ['export.csv'],
  },
  trialMonths: 1,
  price: null,
};

export const owner = () => testAccessActor({ preset: 'owner' });

/** In-memory catalog world around the use cases — no infra imports. */
export const makePlansWorld = (init?: {
  readonly save?: 'ok' | 'conflict';
}) => {
  let catalog: readonly Plan[] = [FREE, PRO, LEGACY, RETIRED];
  const events: BillingEvent[] = [];
  const saves: Array<{
    readonly plan: Plan;
    readonly expectedVersion: number | null;
  }> = [];
  let touches = 0;
  const store: PlanCatalogStore = {
    listPlans: async () => {
      touches += 1;
      return catalog;
    },
    findPlanById: async (planId) => {
      touches += 1;
      return catalog.find((p) => p.id === planId) ?? null;
    },
    findPlanByKey: async (key) => {
      touches += 1;
      return catalog.find((p) => p.key === key) ?? null;
    },
    findDefaultPlan: async () => {
      touches += 1;
      return catalog.find((p) => p.isDefaultForNewOrgs) ?? null;
    },
    countSubscribers: async () => {
      touches += 1;
      return 4;
    },
    listSubscribers: async () => {
      touches += 1;
      return SUBSCRIBERS;
    },
    previewImpact: async () => {
      touches += 1;
      return { wouldGoOverLimit: 2, wouldLoseFeature: 1 };
    },
    savePlan: async (next, expectedVersion, event) => {
      touches += 1;
      if (init?.save === 'conflict') return 'conflict';
      saves.push({ plan: next, expectedVersion });
      events.push(event);
      catalog = [...catalog.filter((p) => p.id !== next.id), next];
      return 'ok';
    },
    setDefaultPlan: async (planId, event) => {
      touches += 1;
      events.push(event);
      catalog = catalog.map((p) => ({
        ...p,
        isDefaultForNewOrgs: p.id === planId,
      }));
    },
  };
  return {
    useCases: makeBillingPlansUseCases({
      plans: store,
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
      ids: sequentialIdGenerator('plan'),
    }),
    events,
    saves,
    touches: () => touches,
    plan: (id: string) => catalog.find((p) => p.id === id) ?? null,
  };
};
