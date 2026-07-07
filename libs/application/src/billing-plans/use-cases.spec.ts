import { describe, expect, it } from 'vitest';
import type { Result } from '@acme/shared';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import type { BillingPlansUseCaseError } from './errors';
import {
  CREATE_INPUT,
  FREE,
  LEGACY,
  PRO,
  RETIRED,
  makePlansWorld,
  owner,
} from './testing';

type Attempt = Promise<Result<unknown, BillingPlansUseCaseError>>;

describe('billing-plans authorization', () => {
  it('denies EVERY operation without plans.manage and never touches the store', async () => {
    for (const preset of ['support', 'customer', 'customer-admin'] as const) {
      const world = makePlansWorld();
      const actor = testAccessActor({ preset });
      const attempts: readonly Attempt[] = [
        world.useCases.listPlans({ actor }),
        world.useCases.previewPlanUpdate({
          actor,
          planId: PRO.id,
          changes: {},
        }),
        world.useCases.createPlan({ actor, input: CREATE_INPUT, reason: 'r' }),
        world.useCases.updatePlan({
          actor,
          planId: PRO.id,
          changes: {},
          expectedVersion: PRO.version,
          reason: 'r',
        }),
        world.useCases.retirePlan({ actor, planId: PRO.id, reason: 'r' }),
        world.useCases.resetPlan({ actor, planId: FREE.id, reason: 'r' }),
        world.useCases.setDefaultPlan({ actor, planId: PRO.id, reason: 'r' }),
        world.useCases.listSubscribers({ actor, planId: PRO.id }),
      ];
      for (const attempt of attempts) {
        const result = await attempt;
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
      }
      expect(world.touches()).toBe(0);
      expect(world.events).toHaveLength(0);
    }
  });

  it('demands a non-empty reason on every staff mutation, before any load', async () => {
    const world = makePlansWorld();
    const actor = owner();
    const attempts: readonly Attempt[] = [
      world.useCases.createPlan({ actor, input: CREATE_INPUT, reason: '   ' }),
      world.useCases.updatePlan({
        actor,
        planId: PRO.id,
        changes: {},
        expectedVersion: PRO.version,
        reason: '',
      }),
      world.useCases.retirePlan({ actor, planId: PRO.id, reason: ' ' }),
      world.useCases.resetPlan({ actor, planId: FREE.id, reason: '' }),
      world.useCases.setDefaultPlan({ actor, planId: PRO.id, reason: '\n' }),
    ];
    for (const attempt of attempts) {
      const result = await attempt;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.tag).toBe('app/reason-required');
    }
    expect(world.touches()).toBe(0);
    expect(world.events).toHaveLength(0);
  });
});

describe('listPlans', () => {
  it('returns the FULL catalog — hidden and retired included', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.listPlans({ actor: owner() });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([FREE, PRO, LEGACY, RETIRED]);
  });
});

describe('previewPlanUpdate', () => {
  it('combines subscriber count and blast radius WITHOUT writing', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.previewPlanUpdate({
      actor: owner(),
      planId: PRO.id,
      changes: {
        entitlements: {
          limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 5 },
          features: [],
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        subscribers: 4,
        wouldGoOverLimit: 2,
        wouldLoseFeature: 1,
      });
    }
    expect(world.saves).toHaveLength(0);
    expect(world.events).toHaveLength(0);
    expect(world.plan(PRO.id)).toEqual(PRO);
  });

  it('reports an unknown plan as not-found', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.previewPlanUpdate({
      actor: owner(),
      planId: 'plan-ghost',
      changes: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/plan-not-found');
  });

  it('surfaces domain validation of the previewed changes', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.previewPlanUpdate({
      actor: owner(),
      planId: PRO.id,
      changes: { displayName: '   ' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('domain/invalid-plan-name');
  });
});

describe('createPlan', () => {
  it('creates a plan and commits plan.created atomically', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.createPlan({
      actor: owner(),
      input: CREATE_INPUT,
      reason: 'new mid tier',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.key).toBe('team');
    expect(result.value.version).toBe(1);
    expect(world.saves[0]?.expectedVersion).toBeNull();
    expect(world.events[0]).toEqual({
      type: 'plan.created',
      plan: result.value,
      actorMembershipId: 'membership-1',
      occurredAt: TEST_ACCESS_NOW,
    });
  });

  it('rejects a key already in the catalog before writing', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.createPlan({
      actor: owner(),
      input: { ...CREATE_INPUT, key: 'free' },
      reason: 'dup',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/plan-key-taken');
    expect(world.saves).toHaveLength(0);
  });

  it('maps a save conflict (creation race) to plan-key-taken too', async () => {
    const world = makePlansWorld({ save: 'conflict' });
    const result = await world.useCases.createPlan({
      actor: owner(),
      input: CREATE_INPUT,
      reason: 'race',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/plan-key-taken');
  });
});
