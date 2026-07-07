import { describe, expect, it } from 'vitest';
import { createPlan, updatePlan } from '../plan/plan';
import type { Plan } from '../plan/plan';
import { markPaid, startSubscription } from '../subscription/subscription';
import type { Subscription } from '../subscription/subscription';
import { billingHold } from './check';

const T0 = '2026-07-04T12:00:00.000Z'; // subscribe; 3mo trial → 2026-10-04
const PRICE_SET = '2026-11-01T00:00:00.000Z'; // pricing launch
const GRACE_END = '2026-12-01T00:00:00.000Z'; // PRICE_SET + 30 days

const unpriced = (): Plan => {
  const result = createPlan(
    {
      key: 'free',
      displayName: 'Free',
      internalNote: 'Fixture.',
      visibility: 'public',
      entitlements: {
        limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
        features: [],
      },
      trialMonths: 3,
      price: null,
    },
    { ids: () => 'plan-free', now: T0 },
  );
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const priced = (): Plan => {
  const result = updatePlan(
    unpriced(),
    { price: { amountCents: 9_900, currency: 'MXN', interval: 'month' } },
    PRICE_SET,
  );
  if (!result.ok) throw new Error('fixture');
  return result.value; // priceSetAt === PRICE_SET
};

const sub = (): Subscription =>
  startSubscription(
    {
      accountId: 'acct-1',
      plan: unpriced(),
      createdByUserId: 'user-1',
      trialAlreadyUsed: false,
    },
    { ids: () => 'sub-1', now: T0 },
  );

const held = (input: {
  plan: Plan;
  now: string;
  sub?: Subscription;
  graceDays?: number;
}) =>
  billingHold({
    sub: input.sub ?? sub(),
    plan: input.plan,
    now: input.now,
    graceDays: input.graceDays ?? 30,
  });

describe('billingHold (ADR-0016 Decision 5)', () => {
  it('never holds a trialing or paid-up org', () => {
    expect(held({ plan: priced(), now: '2026-08-01T00:00:00.000Z' })).toEqual({
      held: false,
    });
    const paid = markPaid(sub(), '2027-02-01T00:00:00.000Z');
    if (!paid.ok) throw new Error('fixture');
    expect(
      held({
        plan: priced(),
        sub: paid.value,
        now: '2027-01-01T00:00:00.000Z',
      }),
    ).toEqual({ held: false });
  });

  it('never holds a past_due org on an unpriced plan, however late', () => {
    // You cannot be delinquent on a plan that had no price while you expired.
    expect(held({ plan: unpriced(), now: '2027-06-01T00:00:00.000Z' })).toEqual(
      { held: false },
    );
  });

  it('holds a past_due org on a priced plan only AFTER the grace window', () => {
    expect(held({ plan: priced(), now: '2026-11-15T00:00:00.000Z' })).toEqual({
      held: false,
    });
    expect(held({ plan: priced(), now: GRACE_END })).toEqual({ held: false }); // strict >
    expect(held({ plan: priced(), now: '2026-12-01T00:00:00.001Z' })).toEqual({
      held: true,
      reason: 'subscription-past-due',
    });
  });

  it('anchors the grace window at priceSetAt, not at expiry', () => {
    // graceDays 0: held the instant the price exists (org expired long ago).
    expect(held({ plan: priced(), now: PRICE_SET, graceDays: 0 })).toEqual({
      held: false,
    });
    expect(
      held({ plan: priced(), now: '2026-11-01T00:00:00.001Z', graceDays: 0 }),
    ).toEqual({ held: true, reason: 'subscription-past-due' });
  });

  it('holds a canceled subscription always — price or not', () => {
    const canceled: Subscription = {
      ...sub(),
      canceledAt: '2026-08-01T00:00:00.000Z',
    };
    for (const plan of [unpriced(), priced()]) {
      expect(held({ plan, sub: canceled, now: T0 })).toEqual({
        held: true,
        reason: 'subscription-canceled',
      });
    }
  });

  it('fails open when priceSetAt is missing even if a price exists', () => {
    // Defensive: both facts are required to activate enforcement.
    const anomalous: Plan = { ...priced(), priceSetAt: null };
    expect(held({ plan: anomalous, now: '2027-06-01T00:00:00.000Z' })).toEqual({
      held: false,
    });
  });
});
