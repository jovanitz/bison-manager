import { describe, expect, it } from 'vitest';
import { createPlan } from '../plan/plan';
import type { Plan } from '../plan/plan';
import {
  addMonths,
  cancelSubscription,
  extendTrial,
  makeSubscriptionId,
  markPaid,
  setOverride,
  startSubscription,
} from './subscription';
import type { Subscription } from './subscription';

const T0 = '2026-07-04T12:00:00.000Z';

const plan = (trialMonths: number): Plan => {
  const result = createPlan(
    {
      key: 'free',
      displayName: 'Free',
      internalNote: 'Seed.',
      visibility: 'public',
      entitlements: {
        limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
        features: [],
      },
      trialMonths,
      price: null,
    },
    { ids: () => 'plan-free', now: T0 },
  );
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const sub = (
  input?: Partial<{ trialMonths: number; used: boolean }>,
): Subscription =>
  startSubscription(
    {
      accountId: 'acct-1',
      plan: plan(input?.trialMonths ?? 3),
      createdByUserId: 'user-1',
      trialAlreadyUsed: input?.used ?? false,
    },
    { ids: () => 'sub-1', now: T0 },
  );

describe('makeSubscriptionId', () => {
  it('accepts and trims a non-empty id', () => {
    const id = makeSubscriptionId(' sub-1 ');
    expect(id.ok && id.value).toBe('sub-1');
  });

  it('rejects an empty id', () => {
    const id = makeSubscriptionId('');
    expect(!id.ok && id.error.tag).toBe('domain/invalid-billing-id');
  });
});

describe('addMonths (calendar math, end-of-month clamped)', () => {
  it.each([
    ['2026-01-31T10:30:00.000Z', 1, '2026-02-28T10:30:00.000Z'], // clamp
    ['2028-01-31T00:00:00.000Z', 1, '2028-02-29T00:00:00.000Z'], // leap year
    ['2026-08-31T00:00:00.000Z', 1, '2026-09-30T00:00:00.000Z'], // 31→30
    ['2026-03-31T06:00:00.000Z', 1, '2026-04-30T06:00:00.000Z'],
    ['2026-11-15T08:00:00.000Z', 3, '2027-02-15T08:00:00.000Z'], // year roll
    ['2026-07-04T12:00:00.000Z', 12, '2027-07-04T12:00:00.000Z'],
    ['2026-07-04T12:00:00.000Z', 0, '2026-07-04T12:00:00.000Z'],
  ])('%s + %imo = %s', (iso, months, expected) => {
    expect(addMonths(iso, months)).toBe(expected);
  });
});

describe('startSubscription', () => {
  it('freezes the trial window at subscribe: startedAt + trialMonths', () => {
    const started = sub();
    expect(started).toEqual({
      id: 'sub-1',
      accountId: 'acct-1',
      planId: 'plan-free',
      createdByUserId: 'user-1',
      startedAt: T0,
      trialEndsAt: '2026-10-04T12:00:00.000Z',
      paidThroughAt: null,
      canceledAt: null,
      overrides: null,
    });
  });

  it('births with the trial consumed when the identity already used one', () => {
    const started = sub({ used: true });
    expect(started.trialEndsAt).toBe(T0);
    expect(started.trialEndsAt).toBe(started.startedAt); // never null
  });

  it('births with no trial when the plan carries none', () => {
    const started = sub({ trialMonths: 0 });
    expect(started.trialEndsAt).toBe(started.startedAt);
  });
});

describe('markPaid (absolute setter)', () => {
  it('sets paidThroughAt to the given ISO date', () => {
    const paid = markPaid(sub(), '2027-01-01T00:00:00.000Z');
    expect(paid.ok && paid.value.paidThroughAt).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('accepts a date-only ISO string and is idempotent under retries', () => {
    const once = markPaid(sub(), '2027-01-01');
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = markPaid(once.value, '2027-01-01');
    expect(twice.ok && twice.value).toEqual(once.value);
  });

  it('rejects a non-ISO date shape', () => {
    for (const raw of ['not-a-date', '31/12/2026', '2026-13-45', '']) {
      const result = markPaid(sub(), raw);
      expect(!result.ok && result.error.tag).toBe(
        'domain/invalid-billing-date',
      );
    }
  });
});

describe('extendTrial (absolute setter)', () => {
  it('moves trialEndsAt and nothing else', () => {
    const before = sub();
    const extended = extendTrial(before, '2027-06-01T00:00:00.000Z');
    expect(extended.ok).toBe(true);
    if (!extended.ok) return;
    expect(extended.value.trialEndsAt).toBe('2027-06-01T00:00:00.000Z');
    expect({ ...extended.value, trialEndsAt: before.trialEndsAt }).toEqual(
      before,
    );
  });

  it('rejects a non-ISO date shape', () => {
    const result = extendTrial(sub(), 'soon');
    expect(!result.ok && result.error.tag).toBe('domain/invalid-billing-date');
  });
});

describe('cancelSubscription', () => {
  it('records the cancellation fact', () => {
    const canceled = cancelSubscription(sub(), '2026-08-01T00:00:00.000Z');
    expect(canceled.canceledAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('is idempotent: a second cancel keeps the original fact', () => {
    const first = cancelSubscription(sub(), '2026-08-01T00:00:00.000Z');
    const second = cancelSubscription(first, '2026-09-01T00:00:00.000Z');
    expect(second.canceledAt).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('setOverride (the per-org exception valve)', () => {
  it('sets and clears the entitlement override', () => {
    const withOverride = setOverride(sub(), {
      limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 25 },
    });
    expect(withOverride.overrides?.limits?.maxMembersPerOrg).toBe(25);
    expect(setOverride(withOverride, null).overrides).toBeNull();
  });
});
