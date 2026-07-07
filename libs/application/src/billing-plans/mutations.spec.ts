import { describe, expect, it } from 'vitest';
import { findPlanSeed } from '@acme/domain';
import { TEST_ACCESS_NOW } from '../access/testing';
import {
  FREE,
  LEGACY,
  PRO,
  RETIRED,
  SUBSCRIBERS,
  makePlansWorld,
  owner,
} from './testing';

describe('updatePlan', () => {
  it('commits plan.updated with FULL before/after, reason and actor', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.updatePlan({
      actor: owner(),
      planId: PRO.id,
      changes: { displayName: 'Pro Max' },
      expectedVersion: PRO.version,
      reason: 'rename for launch',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe('Pro Max');
    expect(result.value.version).toBe(PRO.version + 1);
    expect(world.saves[0]?.expectedVersion).toBe(PRO.version);
    expect(world.events[0]).toEqual({
      type: 'plan.updated',
      planId: PRO.id,
      before: PRO,
      after: result.value,
      actorMembershipId: 'membership-1',
      reason: 'rename for launch',
      occurredAt: TEST_ACCESS_NOW,
    });
  });

  it('maps a version mismatch to plan-concurrently-modified', async () => {
    const world = makePlansWorld({ save: 'conflict' });
    const result = await world.useCases.updatePlan({
      actor: owner(),
      planId: PRO.id,
      changes: { displayName: 'Pro Max' },
      expectedVersion: PRO.version - 1,
      reason: 'stale editor',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('app/plan-concurrently-modified');
    }
  });

  it('reports an unknown plan as not-found', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.updatePlan({
      actor: owner(),
      planId: 'plan-ghost',
      changes: {},
      expectedVersion: 1,
      reason: 'r',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/plan-not-found');
  });
});

describe('retirePlan', () => {
  it('retires a plan and commits plan.retired, CAS at the loaded version', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.retirePlan({
      actor: owner(),
      planId: PRO.id,
      reason: 'superseded by team',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('retired');
    expect(world.saves[0]?.expectedVersion).toBe(PRO.version);
    expect(world.events[0]).toEqual({
      type: 'plan.retired',
      planId: PRO.id,
      actorMembershipId: 'membership-1',
      reason: 'superseded by team',
      occurredAt: TEST_ACCESS_NOW,
    });
  });

  it('never retires the default plan (domain guard passes through)', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.retirePlan({
      actor: owner(),
      planId: FREE.id,
      reason: 'oops',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('domain/default-plan-protected');
    }
    expect(world.saves).toHaveLength(0);
  });

  it('reports an already-retired plan', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.retirePlan({
      actor: owner(),
      planId: RETIRED.id,
      reason: 'again',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('domain/plan-already-retired');
    }
  });
});

describe('resetPlan', () => {
  it('restores the code seed and commits plan.reset with before/after', async () => {
    const world = makePlansWorld();
    const seed = findPlanSeed('free');
    expect(seed).not.toBeNull();
    const result = await world.useCases.resetPlan({
      actor: owner(),
      planId: FREE.id,
      reason: 'undo bad renegotiation',
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !seed) return;
    expect(result.value.displayName).toBe(seed.displayName);
    expect(result.value.trialMonths).toBe(seed.trialMonths);
    expect(result.value.entitlements).toEqual(seed.entitlements);
    expect(result.value.version).toBe(FREE.version + 1);
    // priceSetAt passthrough (domain rule): never priced, seed unpriced → null.
    expect(result.value.priceSetAt).toBeNull();
    expect(world.saves[0]?.expectedVersion).toBe(FREE.version);
    expect(world.events[0]).toMatchObject({
      type: 'plan.reset',
      planId: FREE.id,
      before: FREE,
      after: result.value,
      reason: 'undo bad renegotiation',
    });
  });

  it('fails when the plan key has no code seed', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.resetPlan({
      actor: owner(),
      planId: PRO.id,
      reason: 'no floor',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/plan-seed-missing');
    expect(world.saves).toHaveLength(0);
  });
});

describe('setDefaultPlan', () => {
  it('moves the marker and emits billing.default-plan-changed with from→to', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.setDefaultPlan({
      actor: owner(),
      planId: PRO.id,
      reason: 'pro becomes the landing plan',
    });
    expect(result.ok).toBe(true);
    expect(world.events[0]).toEqual({
      type: 'billing.default-plan-changed',
      fromPlanId: FREE.id,
      toPlanId: PRO.id,
      actorMembershipId: 'membership-1',
      occurredAt: TEST_ACCESS_NOW,
    });
    expect(world.plan(PRO.id)?.isDefaultForNewOrgs).toBe(true);
    expect(world.plan(FREE.id)?.isDefaultForNewOrgs).toBe(false);
  });

  it('refuses hidden or retired plans (domain guard passes through)', async () => {
    for (const target of [LEGACY, RETIRED]) {
      const world = makePlansWorld();
      const result = await world.useCases.setDefaultPlan({
        actor: owner(),
        planId: target.id,
        reason: 'bad target',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.tag).toBe('domain/plan-not-assignable');
      }
      expect(world.events).toHaveLength(0);
    }
  });
});

describe('listSubscribers', () => {
  it('returns the subscribed orgs (org, since-when) to a plans.manage holder', async () => {
    const world = makePlansWorld();
    const result = await world.useCases.listSubscribers({
      actor: owner(),
      planId: PRO.id,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(SUBSCRIBERS);
  });
});
