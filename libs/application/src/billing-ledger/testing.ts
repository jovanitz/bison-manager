import { fixedClock } from '@acme/shared';
import type {
  Charge,
  ChargeId,
  Money,
  Payment,
  Plan,
  PlanId,
  Subscription,
} from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { freePlan, subscription } from '../billing-subscriptions/testing';
import type { BillingLedgerPolicy } from './ports';
import { makeBillingLedgerUseCases } from './use-cases';

/**
 * In-memory billing-ledger world for the spec — no infra. Charges/payments are
 * closures; the clock is pinned to TEST_ACCESS_NOW so the access actors' sessions
 * stay valid and coverage derivations are deterministic.
 */
export const ORG = 'org-1';

/** Staff owner (billing.read:any) — the authorized reader. */
export const staff = testAccessActor({ preset: 'owner' });
/** A customer admin on ANOTHER account — billing.read:own → denied for ORG. */
export const outsider = testAccessActor({
  preset: 'customer-admin',
  accountId: 'other-org',
});

export const DEFAULT_POLICY: BillingLedgerPolicy = {
  dormantDays: 90,
  graceDays: 10,
  currency: 'MXN',
  taxRateBps: 1600,
};

/** A paid $49/mo plan — the fresh charge a beyond-cap payment generates. */
export const proPlan = (over?: Partial<Plan>): Plan =>
  freePlan({
    id: 'plan-pro' as PlanId,
    key: 'pro',
    displayName: 'Pro',
    price: { amountCents: 4900, currency: 'MXN', interval: 'month' },
    priceSetAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

const MXN = (minor: number): Money => ({ minor, currency: 'MXN' });

/** A $49 + 16% IVA monthly charge; override any field for the scenario. */
export const openCharge = (over?: Partial<Charge>): Charge => ({
  id: 'chg-open' as ChargeId,
  accountId: ORG,
  planId: 'plan-free' as PlanId,
  period: { from: '2026-06-05T00:00:00.000Z', to: '2026-07-05T00:00:00.000Z' },
  dueDate: '2026-06-05T00:00:00.000Z',
  subtotal: MXN(4900),
  taxRateBps: 1600,
  tax: MXN(784),
  total: MXN(5684),
  graceDays: 10,
  status: 'open',
  paidAt: null,
  coveredThrough: null,
  ...over,
});

/** A settled charge whose coverage runs to `coveredThrough`. */
export const paidCharge = (over?: Partial<Charge>): Charge =>
  openCharge({
    id: 'chg-paid' as ChargeId,
    status: 'paid',
    paidAt: '2026-06-05T00:00:00.000Z',
    coveredThrough: '2026-07-05T00:00:00.000Z',
    ...over,
  });

const chargeStore = (initial: readonly Charge[]) => {
  let rows: readonly Charge[] = initial;
  return {
    rows: () => rows,
    listByAccount: async (accountId: string) =>
      rows.filter((c) => c.accountId === accountId),
    saveMany: async (charges: readonly Charge[]) => {
      const ids = new Set(charges.map((c) => c.id));
      rows = [...rows.filter((c) => !ids.has(c.id)), ...charges];
    },
  };
};

const paymentStore = () => {
  let rows: readonly Payment[] = [];
  return {
    rows: () => rows,
    listByAccount: async (accountId: string) =>
      rows.filter((p) => p.accountId === accountId),
    findById: async (id: string) => rows.find((p) => p.id === id) ?? null,
    append: async (p: Payment) => {
      rows = [...rows, p];
    },
  };
};

export type LedgerWorldInput = {
  readonly sub?: Subscription | null;
  readonly charges?: readonly Charge[];
  readonly plans?: readonly Plan[];
  readonly policy?: Partial<BillingLedgerPolicy>;
};

export const makeLedgerWorld = (input?: LedgerWorldInput) => {
  const sub = input?.sub === undefined ? subscription() : input.sub;
  const plans = input?.plans ?? [freePlan(), proPlan()];
  const charges = chargeStore(input?.charges ?? []);
  const payments = paymentStore();
  let counter = 0;
  const nextId = () => {
    counter += 1;
    return `led-${counter}`;
  };
  const useCases = makeBillingLedgerUseCases({
    subscriptions: {
      findByAccount: async (accountId: string) =>
        sub && sub.accountId === accountId ? sub : null,
    },
    plans: {
      findPlanById: async (id: string) =>
        plans.find((p) => p.id === id) ?? null,
    },
    charges,
    payments,
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    ids: nextId,
    policy: { ...DEFAULT_POLICY, ...input?.policy },
  });
  return { useCases, charges, payments };
};
