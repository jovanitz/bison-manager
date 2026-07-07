import { describe, expect, it } from 'vitest';
import { createPlan } from '../plan/plan';
import type { Plan, PlanId } from '../plan/plan';
import {
  applyPlanChange,
  cancelSubscription,
  markPaid,
  startSubscription,
  subscriptionPhase,
} from './subscription';
import type { Subscription } from './subscription';

const T0 = '2026-07-04T12:00:00.000Z';
const TRIAL_END = '2026-10-04T12:00:00.000Z'; // T0 + 3 calendar months

const plan = (trialMonths: number, key = 'free'): Plan => {
  const result = createPlan(
    {
      key,
      displayName: 'Plan',
      internalNote: 'Fixture.',
      visibility: 'public',
      entitlements: {
        limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
        features: [],
      },
      trialMonths,
      price: null,
    },
    { ids: () => `plan-${key}`, now: T0 },
  );
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const sub = (trialAlreadyUsed = false): Subscription =>
  startSubscription(
    {
      accountId: 'acct-1',
      plan: plan(3),
      createdByUserId: 'user-1',
      trialAlreadyUsed,
    },
    { ids: () => 'sub-1', now: T0 },
  );

const paidSub = (paidThrough: string): Subscription => {
  const result = markPaid(sub(), paidThrough);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

describe('subscriptionPhase — derived, never stored', () => {
  it('walks the whole lifecycle from one set of facts', () => {
    const paid = paidSub('2027-01-01T00:00:00.000Z');
    // trialing while now < trialEndsAt…
    expect(subscriptionPhase(paid, T0)).toBe('trialing');
    expect(subscriptionPhase(paid, '2026-10-04T11:59:59.000Z')).toBe(
      'trialing',
    );
    // …the boundary is exclusive: at trialEndsAt the trial is over…
    // …then the paid window carries it…
    expect(subscriptionPhase(paid, TRIAL_END)).toBe('active');
    expect(subscriptionPhase(paid, '2026-12-31T23:59:59.000Z')).toBe('active');
    // …and past the paid-through boundary (also exclusive) it is delinquent.
    expect(subscriptionPhase(paid, '2027-01-01T00:00:00.000Z')).toBe(
      'past_due',
    );
    expect(subscriptionPhase(paid, '2027-06-01T00:00:00.000Z')).toBe(
      'past_due',
    );
  });

  it('is past_due when the trial lapses with no payment', () => {
    expect(subscriptionPhase(sub(), TRIAL_END)).toBe('past_due');
  });

  it('re-derives instantly after markPaid — no stale block to reconcile', () => {
    const lapsed = sub();
    expect(subscriptionPhase(lapsed, '2026-11-01T00:00:00.000Z')).toBe(
      'past_due',
    );
    const paid = markPaid(lapsed, '2027-01-01T00:00:00.000Z');
    expect(paid.ok).toBe(true);
    if (paid.ok) {
      expect(subscriptionPhase(paid.value, '2026-11-01T00:00:00.000Z')).toBe(
        'active',
      );
    }
  });

  it('canceled wins over everything, even an unexpired trial or paid window', () => {
    const canceled = cancelSubscription(
      paidSub('2027-01-01T00:00:00.000Z'),
      '2026-08-01T00:00:00.000Z',
    );
    expect(subscriptionPhase(canceled, T0)).toBe('canceled');
    expect(subscriptionPhase(canceled, '2026-12-01T00:00:00.000Z')).toBe(
      'canceled',
    );
  });

  it('a subscription born with its trial consumed starts past_due', () => {
    const noTrial = sub(true);
    expect(noTrial.trialEndsAt).toBe(noTrial.startedAt);
    expect(subscriptionPhase(noTrial, T0)).toBe('past_due');
  });
});

describe('applyPlanChange — the trial is a once-ever budget', () => {
  const pro = plan(6, 'pro');

  it('swaps the plan reference and NOTHING else', () => {
    const before = sub();
    const after = applyPlanChange(before, pro.id);
    expect(after.planId).toBe(pro.id);
    expect({ ...after, planId: before.planId }).toEqual(before);
  });

  it('never grants a fresh trial mid-trial (no ping-pong reset)', () => {
    const mid = applyPlanChange(sub(), pro.id);
    // Still the ORIGINAL window, not startedAt + 6 months.
    expect(mid.trialEndsAt).toBe(TRIAL_END);
    expect(subscriptionPhase(mid, '2026-11-01T00:00:00.000Z')).toBe('past_due');
  });

  it('never revives an expired org: past_due stays past_due', () => {
    const expired = sub();
    const now = '2026-12-01T00:00:00.000Z';
    expect(subscriptionPhase(expired, now)).toBe('past_due');
    const swapped = applyPlanChange(expired, pro.id);
    expect(subscriptionPhase(swapped, now)).toBe('past_due');
  });

  it('keeps the paid window across a plan change', () => {
    const paid = paidSub('2027-01-01T00:00:00.000Z');
    const swapped = applyPlanChange(paid, pro.id);
    expect(swapped.paidThroughAt).toBe('2027-01-01T00:00:00.000Z');
    expect(subscriptionPhase(swapped, '2026-12-01T00:00:00.000Z')).toBe(
      'active',
    );
  });

  it('preserves ids as branded PlanId', () => {
    const swapped = applyPlanChange(sub(), 'plan-pro' as PlanId);
    expect(swapped.planId).toBe('plan-pro');
  });
});
