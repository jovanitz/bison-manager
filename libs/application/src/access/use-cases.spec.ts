import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import { createImpersonationGrant } from '@acme/domain';
import type { AccessActor, AccessGrant } from '@acme/domain';
import type { AccessActorReader, AccessGrantExpiryEntry } from './ports';
import { TEST_ACCESS_NOW, testAccessActor } from './testing';
import { makeAccessUseCases } from './use-cases';

const readerFor = (actor: AccessActor | null): AccessActorReader => ({
  findActorBySession: async () => actor,
});

const makeDeps = (actor: AccessActor | null) => {
  const recorded: AccessGrantExpiryEntry[] = [];
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
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    },
    recorded,
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
    const actor = testAccessActor({ preset: 'customer' });
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
