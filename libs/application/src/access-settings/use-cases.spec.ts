import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type {
  AccessSessionPolicies,
  AccessSettingsUpdated,
} from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makeAccessSettingsUseCases } from './use-cases';

const HOUR = 3_600_000;
const MIN = 60_000;

const makeWorld = () => {
  let stored: { policies: AccessSessionPolicies; version: number } | null =
    null;
  const audit: AccessSettingsUpdated[] = [];
  return {
    audit,
    current: () => stored?.policies ?? null,
    version: () => stored?.version ?? 1,
    deps: {
      settings: {
        loadSessionPolicies: async () =>
          stored?.policies ?? ACCESS_SESSION_POLICY_DEFAULTS,
        loadSessionSettings: async () =>
          stored ?? { policies: ACCESS_SESSION_POLICY_DEFAULTS, version: 1 },
        saveSessionPolicies: async (
          policies: AccessSessionPolicies,
          event: AccessSettingsUpdated,
          expectedVersion: number,
        ) => {
          if ((stored?.version ?? 1) !== expectedVersion) return false;
          stored = { policies, version: expectedVersion + 1 };
          audit.push(event);
          return true;
        },
      },
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    },
  };
};

const tighter = {
  customer: { idleTtlMs: 12 * HOUR, maxLifetimeMs: 48 * HOUR },
  staff: { idleTtlMs: 15 * MIN, maxLifetimeMs: 8 * HOUR },
};

describe('updateSessionPolicy', () => {
  it('lets an owner reconfigure within bounds, audited with before/after', async () => {
    const world = makeWorld();
    const r = await makeAccessSettingsUseCases(world.deps).updateSessionPolicy({
      actor: testAccessActor({ preset: 'owner' }),
      policies: tighter,
    });
    expect(r.ok).toBe(true);
    expect(world.current()).toEqual(tighter);
    expect(world.audit[0]?.type).toBe('settings.updated');
    expect(world.audit[0]?.before).toEqual(ACCESS_SESSION_POLICY_DEFAULTS);
    expect(world.audit[0]?.after).toEqual(tighter);
  });

  it('rejects out-of-bounds policies without saving', async () => {
    const world = makeWorld();
    const r = await makeAccessSettingsUseCases(world.deps).updateSessionPolicy({
      actor: testAccessActor({ preset: 'owner' }),
      policies: {
        ...tighter,
        staff: { idleTtlMs: 1 * MIN, maxLifetimeMs: 8 * HOUR },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-session-policy');
    expect(world.current()).toBeNull();
    expect(world.audit).toHaveLength(0);
  });

  it('rejects a stale expectedVersion without saving (optimistic locking)', async () => {
    const world = makeWorld();
    const uc = makeAccessSettingsUseCases(world.deps);
    const first = await uc.updateSessionPolicy({
      actor: testAccessActor({ preset: 'owner' }),
      policies: tighter,
      expectedVersion: 1,
    });
    expect(first.ok).toBe(true);
    expect(world.version()).toBe(2);

    const stale = await uc.updateSessionPolicy({
      actor: testAccessActor({ preset: 'owner' }),
      policies: tighter,
      expectedVersion: 1,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.tag).toBe('app/settings-conflict');
    expect(world.audit).toHaveLength(1);
  });

  it('denies support and customers', async () => {
    const world = makeWorld();
    const uc = makeAccessSettingsUseCases(world.deps);
    for (const preset of ['support', 'customer'] as const) {
      const r = await uc.updateSessionPolicy({
        actor: testAccessActor({ preset }),
        policies: tighter,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
    expect(world.audit).toHaveLength(0);
  });
});
