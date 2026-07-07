import { describe, expect, it } from 'vitest';
import { DEFAULT_PLANS, findPlanSeed, resetPlanFromSeed } from './seeds';
import type { Plan, PlanPrice } from './plan';
import { createPlan, updatePlan } from './plan';

const T0 = '2026-07-04T12:00:00.000Z';
const T1 = '2026-08-01T00:00:00.000Z';
const PRICE: PlanPrice = {
  amountCents: 9_900,
  currency: 'MXN',
  interval: 'month',
};

describe('DEFAULT_PLANS (the code floor)', () => {
  it('ships exactly one seed: the Free acquisition plan, the default', () => {
    expect(DEFAULT_PLANS).toHaveLength(1);
    expect(DEFAULT_PLANS[0]).toEqual({
      key: 'free',
      displayName: 'Free',
      internalNote: 'The acquisition plan — every new org is born here.',
      visibility: 'public',
      isDefaultForNewOrgs: true,
      entitlements: {
        limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
        features: [],
      },
      trialMonths: 3,
      price: null,
    });
  });

  it('finds a seed by key', () => {
    expect(findPlanSeed('free')?.displayName).toBe('Free');
    expect(findPlanSeed('pro')).toBeNull();
  });

  it('every seed is a valid createPlan input', () => {
    for (const seed of DEFAULT_PLANS) {
      const result = createPlan(seed, { ids: () => 'plan-seed', now: T0 });
      expect(result.ok).toBe(true);
    }
  });
});

describe('resetPlanFromSeed', () => {
  const free = DEFAULT_PLANS[0];

  const livePlan = (): Plan => {
    const created = createPlan(free, { ids: () => 'plan-free', now: T0 });
    if (!created.ok) throw new Error('fixture');
    const drifted = updatePlan(
      created.value,
      {
        displayName: 'Free (drifted)',
        internalNote: 'Edited live.',
        entitlements: {
          limits: { maxOrganizationsOwned: 9, maxMembersPerOrg: 99 },
          features: ['api.access'],
        },
        trialMonths: 12,
        price: PRICE,
      },
      T0,
    );
    if (!drifted.ok) throw new Error('fixture');
    return drifted.value;
  };

  it('restores the commercial terms from the seed and bumps version', () => {
    const reset = resetPlanFromSeed(livePlan(), free, T1);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.value.displayName).toBe('Free');
    expect(reset.value.internalNote).toBe(free.internalNote);
    expect(reset.value.entitlements).toEqual(free.entitlements);
    expect(reset.value.trialMonths).toBe(3);
    expect(reset.value.price).toBeNull();
    expect(reset.value.version).toBe(3); // create(1) → drift(2) → reset(3)
  });

  it('keeps id, key, status and visibility (same row, same subscribers)', () => {
    const before = livePlan();
    const reset = resetPlanFromSeed(before, free, T1);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.value.id).toBe(before.id);
    expect(reset.value.key).toBe('free');
    expect(reset.value.status).toBe(before.status);
    expect(reset.value.visibility).toBe(before.visibility);
  });

  it('keeps the priceSetAt grace anchor once stamped (exactly-once rule)', () => {
    const before = livePlan(); // price was set at T0 → priceSetAt = T0
    expect(before.priceSetAt).toBe(T0);
    const reset = resetPlanFromSeed(before, free, T1); // seed unsets price
    expect(reset.ok).toBe(true);
    if (reset.ok) expect(reset.value.priceSetAt).toBe(T0);
  });
});
