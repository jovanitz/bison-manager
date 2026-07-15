import type {
  EntitlementUsageReader,
  PlanCatalogStore,
  SubscriptionStore,
} from '@acme/application';
import type {
  BillingEvent,
  Plan,
  PlanId,
  Subscription,
  SubscriptionId,
} from '@acme/domain';
import type { InMemoryAccessSeed } from '../../access/in-memory/seed/access-seed';
import type { InMemoryBillingSeed } from '../../billing/in-memory/billing-store-state';

/**
 * Shared fixtures for the billing-store contract suite. Ids are random UUIDs
 * so the same fixtures run against uuid-typed Postgres columns and the
 * in-memory maps alike. The world: a drifted `free` plan (staff-edited, the
 * idempotent-seed probe) with two subscribers (1 and 4 members), a paid `pro`
 * plan with one subscriber, and a fresh account with no subscription yet.
 */
export type BillingStorePorts = {
  readonly plans: PlanCatalogStore;
  readonly subscriptions: SubscriptionStore;
  readonly usage: EntitlementUsageReader;
  /** Billing's own audit stream, in write order (test surface). */
  readonly events: () => Promise<ReadonlyArray<BillingEvent>>;
  /** Idempotent code-floor seeding (the migration/`DEFAULT_PLANS` insert). */
  readonly seedDefaults: () => Promise<void>;
};

export type BillingContractSeed = {
  readonly access: InMemoryAccessSeed;
  readonly billing: InMemoryBillingSeed;
};

/** Store factory each spec provides; DBs must isolate per call (re-seed). */
export type MakeBillingStore = (
  seed: BillingContractSeed,
) => BillingStorePorts | Promise<BillingStorePorts>;

export const BILLING_CONTRACT_NOW = '2026-07-04T12:00:00.000Z';

export const makeBillingContractIds = () => ({
  planFree: crypto.randomUUID() as PlanId,
  planPro: crypto.randomUUID() as PlanId,
  subLone: crypto.randomUUID() as SubscriptionId,
  subCrowded: crypto.randomUUID() as SubscriptionId,
  subPro: crypto.randomUUID() as SubscriptionId,
  /** 1 member (its owner), on free. */
  acctLone: crypto.randomUUID(),
  /** 4 members, on free. */
  acctCrowded: crypto.randomUUID(),
  /** 2 members, on pro; owned by the same user that owns acctLone. */
  acctPro: crypto.randomUUID(),
  /** Exists with no subscription — the upsert playground. */
  acctFresh: crypto.randomUUID(),
  /** Owns acctLone (free) and acctPro (pro); created both trials. */
  userOwner: crypto.randomUUID(),
  /** Plain member of acctPro and acctCrowded — never an owner. */
  userMember: crypto.randomUUID(),
  /** Owns acctCrowded. */
  userFarmer: crypto.randomUUID(),
  actorMembership: crypto.randomUUID(),
});

export type BillingContractIds = ReturnType<typeof makeBillingContractIds>;

/** The seeded free plan DRIFTED by staff edits — reseeding must keep it. */
export const freePlanDrifted = (id: PlanId): Plan => ({
  id,
  key: 'free',
  displayName: 'Free (drifted)',
  internalNote: 'Staff-edited live free plan.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: true,
  entitlements: {
    limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
    features: ['export.csv'],
  },
  trialMonths: 6,
  price: null,
  priceSetAt: null,
  version: 4,
});

export const proPlan = (id: PlanId): Plan => ({
  id,
  key: 'pro',
  displayName: 'Pro',
  internalNote: 'Paid tier.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: false,
  entitlements: {
    limits: { maxOrganizationsOwned: null, maxMembersPerOrg: null },
    features: ['export.csv', 'reports.advanced'],
  },
  trialMonths: 0,
  price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
  priceSetAt: BILLING_CONTRACT_NOW,
  version: 2,
});

export const contractSubscription = (
  over: Pick<Subscription, 'id' | 'accountId' | 'planId' | 'createdByUserId'> &
    Partial<Subscription>,
): Subscription => ({
  startedAt: '2026-05-01T00:00:00.000Z',
  trialEndsAt: '2026-08-01T00:00:00.000Z',
  paidThroughAt: null,
  canceledAt: null,
  overrides: null,
  ...over,
});

const contractMemberships = (ids: BillingContractIds) => {
  const extraMembers = [crypto.randomUUID(), crypto.randomUUID()];
  const member = (userId: string, accountId: string, owner = false) => ({
    id: crypto.randomUUID(),
    userId,
    accountId,
    permissions: [],
    isAccountOwner: owner,
  });
  return [
    member(ids.userOwner, ids.acctLone, true),
    member(ids.userOwner, ids.acctPro, true),
    member(ids.userMember, ids.acctPro),
    member(ids.userFarmer, ids.acctCrowded, true),
    member(ids.userMember, ids.acctCrowded),
    member(extraMembers[0] ?? '', ids.acctCrowded),
    member(extraMembers[1] ?? '', ids.acctCrowded),
  ];
};

export const billingContractSeed = (
  ids: BillingContractIds,
): BillingContractSeed => ({
  access: {
    accounts: [
      { id: ids.acctLone },
      { id: ids.acctCrowded },
      { id: ids.acctPro },
      { id: ids.acctFresh },
    ],
    customers: [
      { accountId: ids.acctLone, displayName: 'Lone Org' },
      { accountId: ids.acctCrowded, displayName: 'Crowded Org' },
      { accountId: ids.acctPro, displayName: 'Pro Org' },
      { accountId: ids.acctFresh, displayName: 'Fresh Org' },
    ],
    memberships: contractMemberships(ids),
  },
  billing: {
    plans: [freePlanDrifted(ids.planFree), proPlan(ids.planPro)],
    subscriptions: [
      contractSubscription({
        id: ids.subLone,
        accountId: ids.acctLone,
        planId: ids.planFree,
        createdByUserId: ids.userOwner,
        startedAt: '2026-05-01T00:00:00.000Z',
      }),
      contractSubscription({
        id: ids.subCrowded,
        accountId: ids.acctCrowded,
        planId: ids.planFree,
        createdByUserId: ids.userFarmer,
        startedAt: '2026-06-01T00:00:00.000Z',
      }),
      contractSubscription({
        id: ids.subPro,
        accountId: ids.acctPro,
        planId: ids.planPro,
        createdByUserId: ids.userOwner,
        paidThroughAt: '2026-12-01T00:00:00.000Z',
      }),
    ],
  },
});
