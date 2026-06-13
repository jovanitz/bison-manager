import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import {
  ACCESS_SESSION_POLICY_DEFAULTS,
  createImpersonationGrant,
} from '@acme/domain';
import type { AccessActor, AccessGrant } from '@acme/domain';
import type {
  AccessActorReader,
  AccessGrantExpiryEntry,
  AccessSessionActivity,
} from './ports';
import { TEST_ACCESS_NOW, testAccessActor } from './testing';
import { makeAccessUseCases } from './use-cases';

const readerFor = (actor: AccessActor | null): AccessActorReader => ({
  findActorBySession: async () => actor,
});

const makeDeps = (actor: AccessActor | null) => {
  const recorded: AccessGrantExpiryEntry[] = [];
  const slides: AccessSessionActivity[] = [];
  return {
    deps: {
      actors: readerFor(actor),
      grantExpiry: {
        recordExpiry: async (
          entries: ReadonlyArray<AccessGrantExpiryEntry>,
        ) => {
          recorded.push(...entries);
        },
      },
      sessionPolicies: {
        loadSessionPolicies: async () => ACCESS_SESSION_POLICY_DEFAULTS,
      },
      sessionActivity: {
        recordSessionActivity: async (activity: AccessSessionActivity) => {
          slides.push(activity);
        },
      },
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    },
    recorded,
    slides,
  };
};

const expiredGrant = (): AccessGrant => {
  const created = createImpersonationGrant({
    id: 'grant-old' as AccessGrant['id'],
    membershipId: 'membership-1' as AccessGrant['membershipId'],
    targetAccountId: 'acct-customer' as AccessGrant['targetAccountId'],
    reason: 'ticket #1',
    occurredAt: '2026-06-09T10:00:00.000Z',
    expiresAt: '2026-06-09T10:30:00.000Z',
  });
  if (!created.ok) throw new Error('setup');
  return created.value.grant;
};

describe('resolveRequestActor', () => {
  it('returns the full actor for an active session', async () => {
    // staff: the slide candidate (now + 30 min) is below the fixture expiry,
    // so nothing is written and the actor comes back untouched.
    const actor = testAccessActor({ preset: 'owner' });
    const { deps } = makeDeps(actor);
    const r = await makeAccessUseCases(deps).resolveRequestActor({
      sessionId: 'session-1',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(actor);
  });

  it('fails closed for an unknown session and a revoked session', async () => {
    const unknown = makeDeps(null);
    const missing = await makeAccessUseCases(unknown.deps).resolveRequestActor({
      sessionId: 'session-x',
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.tag).toBe('app/access-actor-not-found');
    }

    const revoked = makeDeps(
      testAccessActor({ preset: 'owner', sessionStatus: 'revoked' }),
    );
    const denied = await makeAccessUseCases(revoked.deps).resolveRequestActor({
      sessionId: 'session-1',
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.tag).toBe('app/access-denied');
  });

  it('slides a customer session forward on use, bounded writes only', async () => {
    const customer = testAccessActor({ preset: 'customer' });
    const { deps, slides } = makeDeps(customer);
    const r = await makeAccessUseCases(deps).resolveRequestActor({
      sessionId: 'session-1',
    });
    expect(r.ok).toBe(true);
    // customer idle = 24 h from NOW (far from the 72 h cap)
    expect(slides).toEqual([
      {
        sessionId: customer.session.id,
        lastSeenAt: TEST_ACCESS_NOW,
        expiresAt: '2026-06-10T12:00:00.000Z',
        ipAddress: null,
      },
    ]);
    if (r.ok) {
      expect(r.value.session.expiresAt).toBe('2026-06-10T12:00:00.000Z');
    }
  });

  it('does not slide staff sessions when nothing would be gained', async () => {
    const { deps, slides } = makeDeps(testAccessActor({ preset: 'support' }));
    const r = await makeAccessUseCases(deps).resolveRequestActor({
      sessionId: 'session-1',
    });
    expect(r.ok).toBe(true);
    expect(slides).toHaveLength(0);
  });

  it('records grant.expired lazily while resolving', async () => {
    const { deps, recorded } = makeDeps(
      testAccessActor({ preset: 'support', grants: [expiredGrant()] }),
    );
    const r = await makeAccessUseCases(deps).resolveRequestActor({
      sessionId: 'session-1',
    });
    expect(r.ok).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.event.type).toBe('grant.expired');
  });
});

describe('getCurrentAccess', () => {
  it('returns the access snapshot for an active session', async () => {
    const { deps } = makeDeps(testAccessActor({ preset: 'support' }));
    const uc = makeAccessUseCases(deps);
    const r = await uc.getCurrentAccess({ sessionId: 'session-1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.membershipId).toBe('membership-1');
    expect(r.value.permissions).toContainEqual({
      action: 'customer.search',
      scope: 'any',
    });
    expect(r.value.activeGrants).toHaveLength(0);
  });

  it('fails closed for an unknown session', async () => {
    const { deps } = makeDeps(null);
    const r = await makeAccessUseCases(deps).getCurrentAccess({
      sessionId: 'session-x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-actor-not-found');
  });

  it('fails closed for a disabled account and a revoked session', async () => {
    for (const actor of [
      testAccessActor({ preset: 'owner', accountStatus: 'disabled' }),
      testAccessActor({ preset: 'owner', sessionStatus: 'revoked' }),
    ]) {
      const { deps } = makeDeps(actor);
      const r = await makeAccessUseCases(deps).getCurrentAccess({
        sessionId: 'session-1',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
  });

  it('records grant.expired lazily and hides the grant from the snapshot', async () => {
    const grant = expiredGrant();
    const { deps, recorded } = makeDeps(
      testAccessActor({ preset: 'support', grants: [grant] }),
    );
    const r = await makeAccessUseCases(deps).getCurrentAccess({
      sessionId: 'session-1',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.activeGrants).toHaveLength(0);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.event.type).toBe('grant.expired');
    expect(recorded[0]?.grant.expiryRecordedAt).toBe(TEST_ACCESS_NOW);
  });
});
