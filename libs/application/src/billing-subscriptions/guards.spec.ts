import { describe, expect, it } from 'vitest';
import type { PlanId } from '@acme/domain';
import {
  CUSTOMER,
  STAFF,
  errTag,
  freePlan,
  makeGuardsWorld,
  pastDueSubscription,
} from './testing';

// Limit-shaped guards live here; the billing-hold + feature gate specs are in
// guards-hold.spec.ts. Both run against the shared world in testing.ts.

describe('guardOrgCreation', () => {
  it('counts owned orgs on the DEFAULT plan key (per-plan, ADR D2)', async () => {
    const world = makeGuardsWorld({ ownedOrgs: 0 });
    const result = await world.guards.guardOrgCreation({ userId: 'user-9' });
    expect(result.ok).toBe(true);
    expect(world.orgCountCalls).toEqual([
      { userId: 'user-9', planKey: 'free' },
    ]);
  });

  it('denies at the ownership limit with app/plan-limit-exceeded', async () => {
    const world = makeGuardsWorld({ ownedOrgs: 1 });
    const result = await world.guards.guardOrgCreation({ userId: 'user-9' });
    expect(errTag(result)).toBe('app/plan-limit-exceeded');
  });

  it('allows unlimited ownership when the limit is null', async () => {
    const plan = freePlan({
      entitlements: {
        limits: { maxOrganizationsOwned: null, maxMembersPerOrg: 3 },
        features: [],
      },
    });
    const world = makeGuardsWorld({ plans: [plan], ownedOrgs: 500 });
    const result = await world.guards.guardOrgCreation({ userId: 'user-9' });
    expect(result.ok).toBe(true);
  });

  it('fails closed when no default plan exists (never counts usage)', async () => {
    const world = makeGuardsWorld({
      plans: [freePlan({ isDefaultForNewOrgs: false })],
    });
    const result = await world.guards.guardOrgCreation({ userId: 'user-9' });
    expect(errTag(result)).toBe('app/default-plan-missing');
    expect(world.orgCountCalls).toHaveLength(0);
  });
});

describe('guardSeat', () => {
  it('short-circuits ok for staff accounts, never touching the store', async () => {
    const world = makeGuardsWorld({ sub: null });
    const result = await world.guards.guardSeat({ account: STAFF });
    expect(result.ok).toBe(true);
    expect(world.finds()).toBe(0);
  });

  it('allows growth below the seat ceiling', async () => {
    const world = makeGuardsWorld({ members: 2 });
    expect((await world.guards.guardSeat({ account: CUSTOMER })).ok).toBe(true);
  });

  it('denies growth at the ceiling with app/plan-limit-exceeded', async () => {
    const world = makeGuardsWorld({ members: 3 });
    const result = await world.guards.guardSeat({ account: CUSTOMER });
    expect(errTag(result)).toBe('app/plan-limit-exceeded');
  });

  it('applies the per-org override on top of the live plan', async () => {
    const world = makeGuardsWorld({
      sub: pastDueSubscription({
        overrides: {
          limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 25 },
        },
      }),
      members: 5,
    });
    expect((await world.guards.guardSeat({ account: CUSTOMER })).ok).toBe(true);
  });

  it('fails closed for a customer org with no subscription', async () => {
    const world = makeGuardsWorld({ sub: null, members: 0 });
    const result = await world.guards.guardSeat({ account: CUSTOMER });
    expect(errTag(result)).toBe('app/subscription-not-found');
  });

  it('fails closed when the referenced plan is missing', async () => {
    const world = makeGuardsWorld({
      sub: pastDueSubscription({ planId: 'plan-ghost' as PlanId }),
    });
    const result = await world.guards.guardSeat({ account: CUSTOMER });
    expect(errTag(result)).toBe('app/subscription-not-found');
  });
});

describe('seatLimitFor', () => {
  it('returns the plan ceiling when there is no override', async () => {
    const world = makeGuardsWorld();
    expect(await world.guards.seatLimitFor(CUSTOMER)).toBe(3);
  });

  it('returns the overridden ceiling (overrides applied)', async () => {
    const world = makeGuardsWorld({
      sub: pastDueSubscription({
        overrides: {
          limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 25 },
        },
      }),
    });
    expect(await world.guards.seatLimitFor(CUSTOMER)).toBe(25);
  });

  it('returns null for an unlimited plan', async () => {
    const plan = freePlan({
      entitlements: {
        limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: null },
        features: [],
      },
    });
    const world = makeGuardsWorld({ plans: [plan] });
    expect(await world.guards.seatLimitFor(CUSTOMER)).toBeNull();
  });

  it('returns null for staff accounts without touching the store', async () => {
    const world = makeGuardsWorld({ sub: null });
    expect(await world.guards.seatLimitFor(STAFF)).toBeNull();
    expect(world.finds()).toBe(0);
  });

  it('fails closed to 0 without a subscription', async () => {
    const world = makeGuardsWorld({ sub: null });
    expect(await world.guards.seatLimitFor(CUSTOMER)).toBe(0);
  });

  it('fails closed to 0 when the referenced plan is missing', async () => {
    const world = makeGuardsWorld({
      sub: pastDueSubscription({ planId: 'plan-ghost' as PlanId }),
    });
    expect(await world.guards.seatLimitFor(CUSTOMER)).toBe(0);
  });
});
