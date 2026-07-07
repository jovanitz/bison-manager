import { describe, expect, it } from 'vitest';
import type { CreatePlanInput, Plan, PlanPrice } from './plan';
import { createPlan, updatePlan } from './plan';

const T0 = '2026-07-04T12:00:00.000Z';
const T1 = '2026-08-01T00:00:00.000Z';
const T2 = '2026-09-01T00:00:00.000Z';
const PRICE: PlanPrice = {
  amountCents: 49_900,
  currency: 'MXN',
  interval: 'month',
};
const INPUT: CreatePlanInput = {
  key: 'pro',
  displayName: 'Pro',
  internalNote: 'The paid tier.',
  visibility: 'public',
  entitlements: {
    limits: { maxOrganizationsOwned: 5, maxMembersPerOrg: 25 },
    features: ['reports.advanced'],
  },
  trialMonths: 1,
  price: null,
};

const plan = (overrides: Partial<CreatePlanInput> = {}): Plan => {
  const result = createPlan(
    { ...INPUT, ...overrides },
    {
      ids: () => 'plan-1',
      now: T0,
    },
  );
  if (!result.ok) throw new Error(`fixture: ${result.error.message}`);
  return result.value;
};

const updated = (
  base: Plan,
  changes: Parameters<typeof updatePlan>[1],
): Plan => {
  const result = updatePlan(base, changes, T1);
  if (!result.ok) throw new Error(`fixture: ${result.error.message}`);
  return result.value;
};

describe('updatePlan', () => {
  it('applies partial changes and bumps the version', () => {
    const next = updated(plan(), { displayName: 'Pro+', trialMonths: 2 });
    expect(next.displayName).toBe('Pro+');
    expect(next.trialMonths).toBe(2);
    expect(next.version).toBe(2);
    // Untouched fields survive.
    expect(next.internalNote).toBe('The paid tier.');
    expect(next.entitlements).toEqual(INPUT.entitlements);
  });

  it('never touches key, status or the default marker', () => {
    const next = updated(plan(), { displayName: 'Renamed' });
    expect(next.key).toBe('pro');
    expect(next.status).toBe('active');
    expect(next.isDefaultForNewOrgs).toBe(false);
  });

  it('replaces entitlements wholesale (live propagation payload)', () => {
    const next = updated(plan(), {
      entitlements: {
        limits: { maxOrganizationsOwned: null, maxMembersPerOrg: 100 },
        features: [],
      },
    });
    expect(next.entitlements.limits.maxOrganizationsOwned).toBeNull();
    expect(next.entitlements.features).toEqual([]);
  });

  it('validates the changed fields', () => {
    const blank = updatePlan(plan(), { displayName: '  ' }, T1);
    expect(!blank.ok && blank.error.tag).toBe('domain/invalid-plan-name');
    const badPrice = updatePlan(
      plan(),
      { price: { ...PRICE, amountCents: 0 } },
      T1,
    );
    expect(!badPrice.ok && badPrice.error.tag).toBe(
      'domain/invalid-plan-price',
    );
    const badTrial = updatePlan(plan(), { trialMonths: -2 }, T1);
    expect(!badTrial.ok && badTrial.error.tag).toBe(
      'domain/invalid-plan-trial',
    );
  });

  describe('priceSetAt — the grace anchor, stamped exactly once', () => {
    it('stamps now on the null→set transition', () => {
      const next = updated(plan(), { price: PRICE });
      expect(next.price).toEqual(PRICE);
      expect(next.priceSetAt).toBe(T1);
    });

    it('stays put when the price merely changes', () => {
      const priced = plan({ price: PRICE });
      expect(priced.priceSetAt).toBe(T0);
      const next = updated(priced, {
        price: { ...PRICE, amountCents: 59_900 },
      });
      expect(next.priceSetAt).toBe(T0);
    });

    it('stays put when the price is unset back to null', () => {
      const next = updated(plan({ price: PRICE }), { price: null });
      expect(next.price).toBeNull();
      expect(next.priceSetAt).toBe(T0);
    });

    it('does NOT re-stamp on a later unset→set cycle', () => {
      const unset = updated(plan({ price: PRICE }), { price: null });
      const result = updatePlan(unset, { price: PRICE }, T2);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.priceSetAt).toBe(T0);
    });

    it('stays null while no price is involved', () => {
      const next = updated(plan(), { displayName: 'Still unpriced' });
      expect(next.priceSetAt).toBeNull();
    });
  });

  it('accumulates version across successive edits', () => {
    const one = updated(plan(), { displayName: 'A' });
    const two = updated(one, { displayName: 'B' });
    expect(two.version).toBe(3);
  });
});
