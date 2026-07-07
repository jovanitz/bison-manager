import { describe, expect, it } from 'vitest';
import { testAccessActor } from '../access/testing';
import {
  ORG,
  errTag,
  freePlan,
  makeSubsWorld,
  orgAdmin,
  staff,
  subscription,
  support,
} from './testing';

// The billing read (getBillingSummary). The staff lever specs live next to
// their module in mutations/mutations.spec.ts.

/** Priced free plan whose 14-day grace (from priceSetAt) has elapsed. */
const HELD_PLAN = freePlan({
  price: { amountCents: 9900, currency: 'MXN', interval: 'month' },
  priceSetAt: '2026-05-01T00:00:00.000Z',
});

/** Facts that put the default (trialing) subscription past due instead. */
const PAST_DUE = { trialEndsAt: '2026-03-01T00:00:00.000Z' };

describe('getBillingSummary', () => {
  it('derives the full summary for billing.read holders (owner, support)', async () => {
    for (const actor of [staff, support]) {
      const world = makeSubsWorld({ members: 2 });
      const result = await world.useCases.getBillingSummary({
        actor,
        accountId: ORG,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          accountId: ORG,
          planId: 'plan-free',
          planKey: 'free',
          planName: 'Free',
          phase: 'trialing',
          trialEndsAt: '2026-09-01T00:00:00.000Z',
          paidThroughAt: null,
          seats: { used: 2, max: 3 },
          overLimit: false,
          price: null,
          features: ['export.csv'],
          heldForPayment: false,
        });
      }
    }
  });

  it('lets an org admin (billing.read: own) read THEIR OWN org', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.getBillingSummary({
      actor: orgAdmin,
      accountId: ORG,
    });
    expect(result.ok).toBe(true);
  });

  it('denies a foreign org uniformly, never touching the store', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.getBillingSummary({
      actor: testAccessActor({ preset: 'customer-admin', accountId: 'org-9' }),
      accountId: ORG,
    });
    expect(errTag(result)).toBe('app/access-denied');
    expect(world.finds()).toBe(0);
  });

  it('denies actors without billing.read (plain customer)', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.getBillingSummary({
      actor: testAccessActor({ preset: 'customer', accountId: ORG }),
      accountId: ORG,
    });
    expect(errTag(result)).toBe('app/access-denied');
  });

  it('reports overLimit at 5/3 seats — legal, visible state', async () => {
    const world = makeSubsWorld({ members: 5 });
    const result = await world.useCases.getBillingSummary({
      actor: staff,
      accountId: ORG,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seats).toEqual({ used: 5, max: 3 });
      expect(result.value.overLimit).toBe(true);
    }
  });

  it('never reports overLimit on an unlimited plan', async () => {
    const plan = freePlan({
      entitlements: {
        limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: null },
        features: [],
      },
    });
    const world = makeSubsWorld({ plans: [plan], members: 500 });
    const result = await world.useCases.getBillingSummary({
      actor: staff,
      accountId: ORG,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seats).toEqual({ used: 500, max: null });
      expect(result.value.overLimit).toBe(false);
    }
  });

  it('derives past_due + heldForPayment once a priced grace elapsed', async () => {
    const world = makeSubsWorld({
      sub: subscription(PAST_DUE),
      plans: [HELD_PLAN],
    });
    const result = await world.useCases.getBillingSummary({
      actor: staff,
      accountId: ORG,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phase).toBe('past_due');
      expect(result.value.heldForPayment).toBe(true);
    }
  });

  it('reflects the RESOLVED entitlements (per-org overrides applied)', async () => {
    const world = makeSubsWorld({
      sub: subscription({
        overrides: {
          limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 25 },
          features: ['api.access'],
        },
      }),
    });
    const result = await world.useCases.getBillingSummary({
      actor: staff,
      accountId: ORG,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seats.max).toBe(25);
      expect(result.value.features).toEqual(['api.access']);
    }
  });

  it('fails closed when the org has no subscription', async () => {
    const world = makeSubsWorld({ sub: null });
    const result = await world.useCases.getBillingSummary({
      actor: staff,
      accountId: ORG,
    });
    expect(errTag(result)).toBe('app/subscription-not-found');
  });
});
