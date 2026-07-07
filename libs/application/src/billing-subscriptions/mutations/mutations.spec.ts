import { describe, expect, it } from 'vitest';
import type { PlanEntitlements } from '@acme/domain';
import { TEST_ACCESS_NOW } from '../../access/testing';
import {
  ORG,
  errTag,
  makeSubsWorld,
  orgAdmin,
  staff,
  subscription,
  support,
} from '../testing';

const PAID_THROUGH = '2026-12-31T00:00:00.000Z';
const NEW_TRIAL_END = '2026-10-01T00:00:00.000Z';

describe('staff levers — shared contract', () => {
  it('demands a non-empty reason on EVERY lever, saving nothing', async () => {
    const world = makeSubsWorld();
    const calls = [
      world.useCases.markPaid({
        actor: staff,
        accountId: ORG,
        paidThrough: PAID_THROUGH,
        reason: '   ',
      }),
      world.useCases.extendTrial({
        actor: staff,
        accountId: ORG,
        trialEndsAt: NEW_TRIAL_END,
        reason: '',
      }),
      world.useCases.changePlan({
        actor: staff,
        accountId: ORG,
        planId: 'plan-custom',
        reason: ' ',
      }),
      world.useCases.setOverride({
        actor: staff,
        accountId: ORG,
        overrides: null,
        reason: '',
      }),
    ];
    for (const call of calls) {
      expect(errTag(await call)).toBe('app/reason-required');
    }
    expect(world.events).toHaveLength(0);
  });

  it('denies every lever to actors without plans.manage', async () => {
    for (const actor of [support, orgAdmin]) {
      const world = makeSubsWorld();
      const result = await world.useCases.markPaid({
        actor,
        accountId: ORG,
        paidThrough: PAID_THROUGH,
        reason: 'Ticket #7',
      });
      expect(errTag(result)).toBe('app/access-denied');
      expect(world.finds()).toBe(0);
    }
  });

  it('fails closed when the target org has no subscription', async () => {
    const world = makeSubsWorld({ sub: null });
    const result = await world.useCases.markPaid({
      actor: staff,
      accountId: ORG,
      paidThrough: PAID_THROUGH,
      reason: 'Ticket #7',
    });
    expect(errTag(result)).toBe('app/subscription-not-found');
  });
});

describe('markPaid', () => {
  it('sets the ABSOLUTE paid-through date and audits it (no amount)', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.markPaid({
      actor: staff,
      accountId: ORG,
      paidThrough: PAID_THROUGH,
      reason: '  Wire transfer #42  ',
    });
    expect(result.ok).toBe(true);
    expect(world.current()?.paidThroughAt).toBe(PAID_THROUGH);
    expect(world.events).toEqual([
      {
        type: 'subscription.paid-marked',
        subscriptionId: 'sub-1',
        accountId: ORG,
        paidThroughAt: PAID_THROUGH,
        amountNote: null,
        actorMembershipId: 'membership-1',
        reason: 'Wire transfer #42',
        occurredAt: TEST_ACCESS_NOW,
      },
    ]);
  });

  it('records the optional amount note (manual-era accounting)', async () => {
    const world = makeSubsWorld();
    await world.useCases.markPaid({
      actor: staff,
      accountId: ORG,
      paidThrough: PAID_THROUGH,
      reason: 'Wire transfer #42',
      amountNote: ' MXN 1,200 ',
    });
    expect(world.events).toHaveLength(1);
    const event = world.events[0];
    expect(
      event.type === 'subscription.paid-marked' ? event.amountNote : null,
    ).toBe('MXN 1,200');
  });

  it('passes the domain date validation through, saving nothing', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.markPaid({
      actor: staff,
      accountId: ORG,
      paidThrough: 'next tuesday',
      reason: 'Ticket #7',
    });
    expect(errTag(result)).toBe('domain/invalid-billing-date');
    expect(world.events).toHaveLength(0);
  });
});

describe('extendTrial', () => {
  it('sets the ABSOLUTE trial end and audits it', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.extendTrial({
      actor: staff,
      accountId: ORG,
      trialEndsAt: NEW_TRIAL_END,
      reason: 'Appeasement: plan edit hurt them',
    });
    expect(result.ok).toBe(true);
    expect(world.current()?.trialEndsAt).toBe(NEW_TRIAL_END);
    expect(world.events.map((event) => event.type)).toEqual([
      'subscription.trial-extended',
    ]);
  });
});

describe('changePlan', () => {
  it('refuses a RETIRED target even for staff, saving nothing', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.changePlan({
      actor: staff,
      accountId: ORG,
      planId: 'plan-legacy',
      reason: 'Ticket #7',
    });
    expect(errTag(result)).toBe('app/plan-retired');
    expect(world.events).toHaveLength(0);
  });

  it('assigns a HIDDEN active plan and leaves the trial untouched', async () => {
    const world = makeSubsWorld();
    const before = world.current();
    const result = await world.useCases.changePlan({
      actor: staff,
      accountId: ORG,
      planId: 'plan-custom',
      reason: 'Legacy terms for this org',
    });
    expect(result.ok).toBe(true);
    const after = world.current();
    expect(after?.planId).toBe('plan-custom');
    expect(after?.trialEndsAt).toBe(before?.trialEndsAt);
    expect(after?.paidThroughAt).toBe(before?.paidThroughAt);
    expect(world.events).toEqual([
      {
        type: 'subscription.plan-changed',
        subscriptionId: 'sub-1',
        accountId: ORG,
        fromPlanId: 'plan-free',
        toPlanId: 'plan-custom',
        actorMembershipId: 'membership-1',
        reason: 'Legacy terms for this org',
        occurredAt: TEST_ACCESS_NOW,
      },
    ]);
  });

  it('reports a missing target plan as app/plan-not-found', async () => {
    const world = makeSubsWorld();
    const result = await world.useCases.changePlan({
      actor: staff,
      accountId: ORG,
      planId: 'plan-ghost',
      reason: 'Ticket #7',
    });
    expect(errTag(result)).toBe('app/plan-not-found');
  });
});

describe('setOverride', () => {
  it('persists the per-org exception and audits before/after', async () => {
    const overrides: Partial<PlanEntitlements> = {
      limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 25 },
    };
    const world = makeSubsWorld();
    const result = await world.useCases.setOverride({
      actor: staff,
      accountId: ORG,
      overrides,
      reason: 'They keep 25 seats',
    });
    expect(result.ok).toBe(true);
    expect(world.current()?.overrides).toEqual(overrides);
    expect(world.events).toEqual([
      {
        type: 'subscription.override-set',
        subscriptionId: 'sub-1',
        accountId: ORG,
        before: null,
        after: overrides,
        actorMembershipId: 'membership-1',
        reason: 'They keep 25 seats',
        occurredAt: TEST_ACCESS_NOW,
      },
    ]);
  });

  it('clears the exception back to null', async () => {
    const world = makeSubsWorld({
      sub: subscription({ overrides: { features: ['api.access'] } }),
    });
    const result = await world.useCases.setOverride({
      actor: staff,
      accountId: ORG,
      overrides: null,
      reason: 'Deal ended',
    });
    expect(result.ok).toBe(true);
    expect(world.current()?.overrides).toBeNull();
  });
});
