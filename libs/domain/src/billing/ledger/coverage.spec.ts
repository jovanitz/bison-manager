import { describe, expect, it } from 'vitest';
import type { PlanId } from '../plan/plan';
import type {
  Subscription,
  SubscriptionId,
} from '../subscription/subscription';
import { money } from '../money/money';
import { createCharge } from './charge';
import { settleCharge } from './settle';
import { deriveCoverage } from './coverage';
import type { Charge } from './ledger';

const POLICY = { dormantDays: 90 };
const mxn = (minor: number) => {
  const r = money(minor, 'MXN');
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 'sub_1' as SubscriptionId,
  accountId: 'org_11',
  planId: 'plan_pro' as PlanId,
  createdByUserId: 'u1',
  startedAt: '2026-01-01',
  trialEndsAt: '2026-02-01',
  paidThroughAt: null,
  canceledAt: null,
  overrides: null,
  ...over,
});

// Open charge for May: due 5 May, grace 10 → suspends 15 May.
const openCharge = (): Charge => {
  const r = createCharge(
    {
      accountId: 'org_11',
      planId: 'plan_pro' as PlanId,
      period: { from: '2026-05-05', to: '2026-06-05' },
      subtotal: mxn(4900),
      taxRateBps: 1600,
      graceDays: 10,
    },
    { ids: () => 'chg' },
  );
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

const paidCharge = (payAt: string): Charge => {
  const s = settleCharge(openCharge(), payAt, POLICY);
  if (s.kind !== 'settled') throw new Error('fixture');
  return s.charge;
};

const derive = (charges: readonly Charge[], now: string, over = {}) =>
  deriveCoverage({
    subscription: sub(over),
    charges,
    currency: 'MXN',
    now,
    policy: POLICY,
  });

describe('deriveCoverage — phase', () => {
  it('trialing before the trial ends', () => {
    expect(derive([openCharge()], '2026-01-15').phase).toBe('trialing');
  });

  it('active while a paid charge still covers now', () => {
    const c = paidCharge('2026-05-06'); // covers to 5 Jun
    expect(derive([c], '2026-05-20').phase).toBe('active');
  });

  it('grace after the period ends but still inside the grace window', () => {
    expect(derive([openCharge()], '2026-05-10').phase).toBe('grace');
  });

  it('suspended once grace has elapsed', () => {
    const cov = derive([openCharge()], '2026-05-20');
    expect(cov.phase).toBe('suspended');
    expect(cov.dormant).toBe(false);
  });

  it('flags dormant when suspended past the dormant window', () => {
    const cov = derive([openCharge()], '2026-09-20'); // >90 days off
    expect(cov.phase).toBe('suspended');
    expect(cov.dormant).toBe(true);
  });

  it('canceled once an explicitly-canceled sub is past its paid coverage', () => {
    expect(
      derive([openCharge()], '2026-05-20', { canceledAt: '2026-05-01' }).phase,
    ).toBe('canceled');
  });
});

describe('deriveCoverage — paid-through & balance', () => {
  it('paid-through = the coveredThrough of the paid charge (downtime baked in)', () => {
    const c = paidCharge('2026-05-18'); // +3 days
    expect(derive([c], '2026-05-06').paidThroughAt).toBe(
      '2026-06-08T00:00:00.000Z',
    );
  });

  it('balance = sum of open charge totals', () => {
    expect(derive([openCharge(), openCharge()], '2026-05-10').balance).toEqual(
      mxn(5684 * 2),
    );
  });
});
