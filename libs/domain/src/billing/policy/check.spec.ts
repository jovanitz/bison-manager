import { describe, expect, it } from 'vitest';
import type { PlanEntitlements } from '../entitlements';
import { createPlan } from '../plan/plan';
import type { Plan } from '../plan/plan';
import { checkLimit, hasFeature, resolveEntitlements } from './check';

const T0 = '2026-07-04T12:00:00.000Z';

const ENTITLEMENTS: PlanEntitlements = {
  limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
  features: ['reports.advanced', 'export.csv'],
};

const plan = (): Plan => {
  const result = createPlan(
    {
      key: 'pro',
      displayName: 'Pro',
      internalNote: 'Fixture.',
      visibility: 'public',
      entitlements: ENTITLEMENTS,
      trialMonths: 0,
      price: null,
    },
    { ids: () => 'plan-pro', now: T0 },
  );
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

describe('resolveEntitlements (plan + per-org override)', () => {
  it('returns the plan entitlements when there is no override', () => {
    expect(resolveEntitlements(plan(), null)).toEqual(ENTITLEMENTS);
  });

  it('shallow-merges limit overrides over the plan limits', () => {
    const resolved = resolveEntitlements(plan(), {
      limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 25 },
    });
    expect(resolved.limits).toEqual({
      maxOrganizationsOwned: 1,
      maxMembersPerOrg: 25,
    });
    // Features untouched by a limits-only override.
    expect(resolved.features).toEqual(ENTITLEMENTS.features);
  });

  it('REPLACES the feature list when the override carries one', () => {
    const resolved = resolveEntitlements(plan(), { features: ['api.access'] });
    expect(resolved.features).toEqual(['api.access']);
  });

  it('an explicit empty feature override strips every feature', () => {
    expect(resolveEntitlements(plan(), { features: [] }).features).toEqual([]);
  });

  it('an override can lift a limit to unlimited (null)', () => {
    const resolved = resolveEntitlements(plan(), {
      limits: { maxOrganizationsOwned: null, maxMembersPerOrg: null },
    });
    expect(resolved.limits.maxMembersPerOrg).toBeNull();
  });
});

describe('checkLimit (growth-only gate)', () => {
  it('allows growth while usage + 1 fits the ceiling', () => {
    expect(checkLimit({ max: 3, usage: 0 })).toEqual({ allowed: true });
    expect(checkLimit({ max: 3, usage: 2 })).toEqual({ allowed: true });
  });

  it('denies growth at the ceiling — a decision, not an error', () => {
    expect(checkLimit({ max: 3, usage: 3 })).toEqual({
      allowed: false,
      reason: 'limit-exceeded',
    });
  });

  it('denies growth from an over-limit state (legal after a downgrade)', () => {
    expect(checkLimit({ max: 3, usage: 5 }).allowed).toBe(false);
  });

  it('null means unlimited', () => {
    expect(checkLimit({ max: null, usage: 1_000_000 }).allowed).toBe(true);
  });

  it('a zero ceiling denies the first unit', () => {
    expect(checkLimit({ max: 0, usage: 0 }).allowed).toBe(false);
  });
});

describe('hasFeature (deny-by-default)', () => {
  it('is true only for features the entitlements carry', () => {
    expect(hasFeature(ENTITLEMENTS, 'reports.advanced')).toBe(true);
    expect(hasFeature(ENTITLEMENTS, 'api.access')).toBe(false);
  });

  it('resolved overrides drive the answer', () => {
    const resolved = resolveEntitlements(plan(), { features: [] });
    expect(hasFeature(resolved, 'reports.advanced')).toBe(false);
  });
});
