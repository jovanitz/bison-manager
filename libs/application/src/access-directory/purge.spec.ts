import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { AccessAuditEvent } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makePurgeOrphanIdentity } from './purge';
import type { OrphanIdentitySummary } from './ports';

const ORPHAN: OrphanIdentitySummary = {
  userId: 'usr-zombie',
  email: 'zombie@acme.test',
  createdAt: TEST_ACCESS_NOW,
};

const makeWorld = (input?: {
  orphans?: ReadonlyArray<OrphanIdentitySummary>;
  memberships?: ReadonlyArray<unknown>;
  pendingInvite?: boolean;
  purgeFails?: boolean;
}) => {
  const deleted: string[] = [];
  const audited: AccessAuditEvent[] = [];
  const purge = makePurgeOrphanIdentity({
    staffDirectory: {
      listOrphanIdentities: async () => input?.orphans ?? [ORPHAN],
    },
    members: {
      listMembershipsByUser: async () => (input?.memberships ?? []) as never,
    },
    invitations: {
      findPendingByEmail: async () =>
        input?.pendingInvite ? ({ invitationId: 'inv-1' } as never) : null,
    },
    purger: {
      deleteIdentity: async (userId) => {
        if (input?.purgeFails) {
          return {
            ok: false,
            error: { tag: 'app/identity-purge-failed', message: 'gone wrong' },
          };
        }
        deleted.push(userId);
        return { ok: true, value: undefined };
      },
    },
    auditTrail: {
      append: async (event) => {
        audited.push(event);
      },
    },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  });
  return { purge, deleted, audited };
};

const owner = () => testAccessActor({ preset: 'owner' });

describe('purgeOrphanIdentity', () => {
  it('erases an orphan and audits it with the email (the identity is then gone)', async () => {
    const world = makeWorld();
    const result = await world.purge({ actor: owner(), userId: 'usr-zombie' });

    expect(result.ok).toBe(true);
    expect(world.deleted).toEqual(['usr-zombie']);
    expect(world.audited[0]).toMatchObject({
      type: 'identity.deleted',
      userId: 'usr-zombie',
      // Carried on the event because the identity can no longer be looked up.
      email: 'zombie@acme.test',
    });
  });

  it('REFUSES a userId the orphan view does not list — never trust the client', async () => {
    const world = makeWorld({ orphans: [] });
    const result = await world.purge({ actor: owner(), userId: 'usr-real' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/identity-not-orphan');
    expect(world.deleted).toEqual([]);
  });

  it('REFUSES an identity that holds a membership, even if listed as an orphan', async () => {
    // The dangerous case: a stale orphan view (they accepted an invitation a
    // second ago). The independent membership check is what saves a real user.
    const world = makeWorld({ memberships: [{ id: 'membership-1' }] });
    const result = await world.purge({ actor: owner(), userId: 'usr-zombie' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/identity-not-orphan');
    expect(world.deleted).toEqual([]);
  });

  it('REFUSES an orphan with a pending invitation — the FK cascade makes that race lethal', async () => {
    // `memberships.user_id` is ON DELETE CASCADE against auth.users, so erasing
    // an identity silently erases its memberships. An orphan who accepts their
    // invitation in the check→delete window would have that brand-new membership
    // destroyed. Refusing while an invitation is outstanding closes that path.
    const world = makeWorld({ pendingInvite: true });
    const result = await world.purge({ actor: owner(), userId: 'usr-zombie' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/identity-not-orphan');
    expect(world.deleted).toEqual([]);
  });

  it('does not audit a delete the provider refused', async () => {
    const world = makeWorld({ purgeFails: true });
    const result = await world.purge({ actor: owner(), userId: 'usr-zombie' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/identity-purge-failed');
    // The trail records what HAPPENED, never what was attempted.
    expect(world.audited).toEqual([]);
  });

  it('denies support and customers — this is owner-only, and never touches the provider', async () => {
    for (const preset of ['support', 'customer'] as const) {
      const world = makeWorld();
      const result = await world.purge({
        actor: testAccessActor({ preset }),
        userId: 'usr-zombie',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
      expect(world.deleted).toEqual([]);
    }
  });
});
