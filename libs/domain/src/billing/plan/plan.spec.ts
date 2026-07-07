import { describe, expect, it } from 'vitest';
import type { CreatePlanInput, Plan, PlanPrice } from './plan';
import { createPlan, makePlanId, markDefault, retirePlan } from './plan';

const T0 = '2026-07-04T12:00:00.000Z';
const DEPS = { ids: () => 'plan-1', now: T0 };
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
    features: ['reports.advanced', 'export.csv'],
  },
  trialMonths: 1,
  price: null,
};

const plan = (overrides: Partial<CreatePlanInput> = {}): Plan => {
  const result = createPlan({ ...INPUT, ...overrides }, DEPS);
  if (!result.ok) throw new Error(`fixture: ${result.error.message}`);
  return result.value;
};

describe('makePlanId', () => {
  it('accepts and trims a non-empty id', () => {
    const id = makePlanId('  plan-1  ');
    expect(id.ok && id.value).toBe('plan-1');
  });

  it('rejects an empty id', () => {
    const id = makePlanId('   ');
    expect(!id.ok && id.error.tag).toBe('domain/invalid-billing-id');
  });
});

describe('createPlan', () => {
  it('births an active, non-default plan at version 1', () => {
    const created = plan();
    expect(created).toMatchObject({
      id: 'plan-1',
      key: 'pro',
      displayName: 'Pro',
      status: 'active',
      visibility: 'public',
      isDefaultForNewOrgs: false,
      trialMonths: 1,
      price: null,
      priceSetAt: null,
      version: 1,
    });
  });

  it('stamps priceSetAt = now when born with a price', () => {
    const created = plan({ price: PRICE });
    expect(created.price).toEqual(PRICE);
    expect(created.priceSetAt).toBe(T0);
  });

  it('leaves priceSetAt null when born unpriced', () => {
    expect(plan().priceSetAt).toBeNull();
  });

  it('trims displayName and internalNote', () => {
    const created = plan({ displayName: '  Pro  ', internalNote: ' x ' });
    expect(created.displayName).toBe('Pro');
    expect(created.internalNote).toBe('x');
  });

  const rejectionTag = (overrides: Partial<CreatePlanInput>): string | null => {
    const result = createPlan({ ...INPUT, ...overrides }, DEPS);
    return result.ok ? null : result.error.tag;
  };

  it('rejects a blank displayName or internalNote', () => {
    expect(rejectionTag({ displayName: '   ' })).toBe(
      'domain/invalid-plan-name',
    );
    expect(rejectionTag({ internalNote: '' })).toBe('domain/invalid-plan-name');
  });

  it('rejects a key that is not a [a-z0-9-] slug', () => {
    for (const key of ['', 'Pro', 'pro plan', 'pro_plan', 'pró']) {
      expect(rejectionTag({ key })).toBe('domain/invalid-plan-key');
    }
  });

  it('accepts slug keys', () => {
    expect(plan({ key: 'pro-legacy-2026' }).key).toBe('pro-legacy-2026');
  });

  it('rejects a negative or fractional trialMonths', () => {
    expect(rejectionTag({ trialMonths: -1 })).toBe('domain/invalid-plan-trial');
    expect(rejectionTag({ trialMonths: 1.5 })).toBe(
      'domain/invalid-plan-trial',
    );
  });

  it('accepts trialMonths 0 (no trial)', () => {
    expect(plan({ trialMonths: 0 }).trialMonths).toBe(0);
  });

  it('rejects a non-positive or fractional price', () => {
    for (const amountCents of [0, -5, 10.5]) {
      expect(rejectionTag({ price: { ...PRICE, amountCents } })).toBe(
        'domain/invalid-plan-price',
      );
    }
  });

  it('fails closed when the id generator yields an empty id', () => {
    const result = createPlan(INPUT, { ids: () => '', now: T0 });
    expect(!result.ok && result.error.tag).toBe('domain/invalid-billing-id');
  });
});

describe('retirePlan', () => {
  it('retires an active plan (frozen, never deleted)', () => {
    const retired = retirePlan(plan());
    expect(retired.ok && retired.value.status).toBe('retired');
  });

  it('protects the default plan for new orgs', () => {
    const marked = markDefault(plan());
    if (!marked.ok) throw new Error('fixture');
    const result = retirePlan(marked.value);
    expect(!result.ok && result.error.tag).toBe(
      'domain/default-plan-protected',
    );
  });

  it('rejects retiring twice', () => {
    const once = retirePlan(plan());
    if (!once.ok) throw new Error('fixture');
    const twice = retirePlan(once.value);
    expect(!twice.ok && twice.error.tag).toBe('domain/plan-already-retired');
  });
});

describe('markDefault', () => {
  it('marks a public active plan as the default for new orgs', () => {
    const marked = markDefault(plan());
    expect(marked.ok && marked.value.isDefaultForNewOrgs).toBe(true);
  });

  it('refuses a hidden plan (the default must be customer-visible)', () => {
    const result = markDefault(plan({ visibility: 'hidden' }));
    expect(!result.ok && result.error.tag).toBe('domain/plan-not-assignable');
  });

  it('refuses a retired plan (closed to new subscriptions)', () => {
    const retired = retirePlan(plan());
    if (!retired.ok) throw new Error('fixture');
    const result = markDefault(retired.value);
    expect(!result.ok && result.error.tag).toBe('domain/plan-not-assignable');
  });
});
