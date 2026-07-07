import { describe, expect, it } from 'vitest';
import type { Plan } from '@acme/domain';
import {
  CUSTOMER,
  STAFF,
  errTag,
  freePlan,
  makeGuardsWorld,
  pastDueSubscription,
} from './testing';

// Billing-hold + feature gate halves of the guards spec; the limit-shaped
// guards (org creation, seats, seat ceiling) live in guards.spec.ts.

/** Priced plan whose grace window (14 days from `priceSetAt`) has elapsed. */
const pricedPlan = (over?: Partial<Plan>): Plan =>
  freePlan({
    price: { amountCents: 9900, currency: 'MXN', interval: 'month' },
    priceSetAt: '2026-06-01T00:00:00.000Z',
    ...over,
  });

/** Facts that keep the default (past-due) subscription trialing instead. */
const TRIALING = { trialEndsAt: '2026-12-01T00:00:00.000Z' };

describe('guardHold', () => {
  it('short-circuits ok for staff accounts', async () => {
    const world = makeGuardsWorld({ sub: null });
    const result = await world.guards.guardHold({ account: STAFF });
    expect(result.ok).toBe(true);
    expect(world.finds()).toBe(0);
  });

  it('passes a trialing subscription and records nothing', async () => {
    const world = makeGuardsWorld({ sub: pastDueSubscription(TRIALING) });
    const result = await world.guards.guardHold({ account: CUSTOMER });
    expect(result.ok).toBe(true);
    expect(world.recordCalls()).toBe(0);
  });

  it('passes a paid (active) subscription on a priced plan', async () => {
    const world = makeGuardsWorld({
      sub: pastDueSubscription({ paidThroughAt: '2027-01-01T00:00:00.000Z' }),
      plans: [pricedPlan()],
    });
    expect((await world.guards.guardHold({ account: CUSTOMER })).ok).toBe(true);
  });

  it('never holds past_due on an UNPRICED plan, but records the expiry', async () => {
    const world = makeGuardsWorld();
    const result = await world.guards.guardHold({ account: CUSTOMER });
    expect(result.ok).toBe(true);
    expect(world.events.map((event) => event.type)).toEqual([
      'subscription.trial-expired',
    ]);
  });

  it('respects the grace window anchored at priceSetAt', async () => {
    const world = makeGuardsWorld({
      plans: [pricedPlan({ priceSetAt: '2026-06-25T00:00:00.000Z' })],
    });
    expect((await world.guards.guardHold({ account: CUSTOMER })).ok).toBe(true);
  });

  it('holds past_due on a priced plan once grace has elapsed', async () => {
    const world = makeGuardsWorld({ plans: [pricedPlan()] });
    const result = await world.guards.guardHold({ account: CUSTOMER });
    expect(errTag(result)).toBe('app/subscription-expired');
  });

  it('holds a canceled subscription', async () => {
    const world = makeGuardsWorld({
      sub: pastDueSubscription({ canceledAt: '2026-06-01T00:00:00.000Z' }),
    });
    const result = await world.guards.guardHold({ account: CUSTOMER });
    expect(errTag(result)).toBe('app/subscription-expired');
  });

  it('records trial-expired exactly ONCE across concurrent observers (CAS)', async () => {
    const world = makeGuardsWorld();
    await world.guards.guardHold({ account: CUSTOMER });
    await world.guards.guardHold({ account: CUSTOMER });
    expect(world.recordCalls()).toBe(2);
    expect(
      world.events.filter((e) => e.type === 'subscription.trial-expired'),
    ).toHaveLength(1);
  });

  it('fails closed for a customer org with no subscription', async () => {
    const world = makeGuardsWorld({ sub: null });
    const result = await world.guards.guardHold({ account: CUSTOMER });
    expect(errTag(result)).toBe('app/subscription-not-found');
  });
});

describe('guardFeature', () => {
  it('short-circuits ok for staff accounts', async () => {
    const world = makeGuardsWorld({ sub: null });
    const result = await world.guards.guardFeature({
      account: STAFF,
      feature: 'api.access',
    });
    expect(result.ok).toBe(true);
  });

  it('allows a feature the resolved plan includes', async () => {
    const world = makeGuardsWorld({ sub: pastDueSubscription(TRIALING) });
    const result = await world.guards.guardFeature({
      account: CUSTOMER,
      feature: 'export.csv',
    });
    expect(result.ok).toBe(true);
  });

  it('denies a feature outside the plan with app/feature-not-in-plan', async () => {
    const world = makeGuardsWorld({ sub: pastDueSubscription(TRIALING) });
    const result = await world.guards.guardFeature({
      account: CUSTOMER,
      feature: 'api.access',
    });
    expect(errTag(result)).toBe('app/feature-not-in-plan');
  });

  it('lets the hold denial WIN over the feature miss', async () => {
    const world = makeGuardsWorld({ plans: [pricedPlan()] });
    const result = await world.guards.guardFeature({
      account: CUSTOMER,
      feature: 'api.access',
    });
    expect(errTag(result)).toBe('app/subscription-expired');
  });

  it('a features override REPLACES the plan list', async () => {
    const world = makeGuardsWorld({
      sub: pastDueSubscription({
        ...TRIALING,
        overrides: { features: ['api.access'] },
      }),
    });
    const granted = await world.guards.guardFeature({
      account: CUSTOMER,
      feature: 'api.access',
    });
    expect(granted.ok).toBe(true);
    const revoked = await world.guards.guardFeature({
      account: CUSTOMER,
      feature: 'export.csv',
    });
    expect(errTag(revoked)).toBe('app/feature-not-in-plan');
  });
});
