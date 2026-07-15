import { accessPresetPermissions } from '@acme/domain';
import type { Plan, PlanId, SubscriptionId } from '@acme/domain';
import type {
  InMemoryAccessSeed,
  InMemoryBillingSeed,
} from '@acme/infrastructure';

/**
 * The standard phase-3 world for the dev server and the contract tests: one
 * account per preset, one session each (the bearer token IS the session id —
 * `Bearer session-owner` etc.), a pre-revoked customer session, and a customer
 * directory holding ONLY the customer account (a staff account listed there
 * would become impersonable). Phase 4 replaces this with real Supabase rows.
 */
const hourAgo = (): string => new Date(Date.now() - 3_600_000).toISOString();

/**
 * Identities in the auth provider. The first three hold memberships; the last
 * does NOT — it is the ORPHAN the directory lists and can purge (a sign-up that
 * never onboarded). Keeping one in the seed is what makes the purge's guards
 * exercisable end to end instead of theoretical.
 */
const SEED_USERS: InMemoryAccessSeed['users'] = [
  { id: 'user-owner' },
  { id: 'user-support' },
  { id: 'user-customer' },
  {
    id: 'user-zombie',
    email: 'zombie@acme.test',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
];

export const seedWorld = (config: {
  readonly sessionExpiresAt: string;
  /** Login instant of the seeded sessions (defaults to one hour ago). */
  readonly sessionCreatedAt?: string;
}): InMemoryAccessSeed => ({
  accounts: [
    { id: 'acct-owner' },
    { id: 'acct-support' },
    { id: 'acct-customer' },
  ],
  memberships: [
    {
      id: 'membership-owner',
      userId: 'user-owner',
      accountId: 'acct-owner',
      permissions: accessPresetPermissions('owner'),
      isRoot: true,
    },
    {
      id: 'membership-support',
      userId: 'user-support',
      accountId: 'acct-support',
      permissions: accessPresetPermissions('support'),
    },
    {
      id: 'membership-customer',
      userId: 'user-customer',
      accountId: 'acct-customer',
      permissions: accessPresetPermissions('customer'),
    },
  ],
  sessions: [
    {
      id: 'session-owner',
      membershipId: 'membership-owner',
      expiresAt: config.sessionExpiresAt,
      createdAt: config.sessionCreatedAt ?? hourAgo(),
    },
    {
      id: 'session-support',
      membershipId: 'membership-support',
      expiresAt: config.sessionExpiresAt,
      createdAt: config.sessionCreatedAt ?? hourAgo(),
    },
    {
      id: 'session-customer',
      membershipId: 'membership-customer',
      expiresAt: config.sessionExpiresAt,
      createdAt: config.sessionCreatedAt ?? hourAgo(),
    },
    {
      id: 'session-revoked',
      membershipId: 'membership-customer',
      expiresAt: config.sessionExpiresAt,
      createdAt: config.sessionCreatedAt ?? hourAgo(),
      status: 'revoked',
    },
  ],
  customers: [
    {
      accountId: 'acct-customer',
      displayName: 'Casa Pampa',
      email: 'ops@casapampa.example',
    },
  ],
  users: SEED_USERS,
});

/**
 * The billing companion of the seeded world (ADR-0016): deterministic twins
 * of the plans (ids the tests can reference — the store's own code-floor
 * seeding mints random ids) plus one subscription for the customer org.
 * Seeding a plan with key `free` makes the idempotent code-floor pass skip
 * its own copy, so `plan-free` IS the default plan everywhere.
 */
export const SEED_PLAN_FREE: Plan = {
  id: 'plan-free' as PlanId,
  key: 'free',
  displayName: 'Free',
  internalNote: 'Code-floor twin with a deterministic id for dev/tests.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: true,
  entitlements: {
    limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
    features: [],
  },
  trialMonths: 3,
  price: null,
  priceSetAt: null,
  version: 1,
};

/** Premium, unpriced tier — carries features for the feature-gate contracts. */
export const SEED_PLAN_PRO: Plan = {
  id: 'plan-pro' as PlanId,
  key: 'pro',
  displayName: 'Pro',
  internalNote: 'Premium tier for the feature-gate and lever contracts.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: false,
  entitlements: {
    limits: { maxOrganizationsOwned: null, maxMembersPerOrg: null },
    features: ['reports.advanced', 'export.csv'],
  },
  trialMonths: 0,
  price: null,
  priceSetAt: null,
  version: 1,
};

/**
 * `acct-customer`'s subscription: trial over and unpaid — `past_due` at the
 * test clock (2026-06-09) — but on the UNPRICED free plan, so there is no
 * billing hold; `billing.markPaid` flips the derived phase to `active`.
 */
export const seedBillingWorld = (config?: {
  readonly customerPlanId?: PlanId;
}): InMemoryBillingSeed => ({
  plans: [SEED_PLAN_FREE, SEED_PLAN_PRO],
  subscriptions: [
    {
      id: 'sub-customer' as SubscriptionId,
      accountId: 'acct-customer',
      planId: config?.customerPlanId ?? SEED_PLAN_FREE.id,
      createdByUserId: 'user-customer',
      startedAt: '2026-03-01T00:00:00.000Z',
      trialEndsAt: '2026-06-01T00:00:00.000Z',
      paidThroughAt: null,
      canceledAt: null,
      overrides: null,
    },
  ],
});
