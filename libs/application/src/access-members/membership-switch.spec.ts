import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type {
  AccessSessionSwitched,
  AccountId,
  MembershipId,
} from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import type { MyMembershipSnapshot } from './ports';
import { makeAccessMembersUseCases } from './use-cases';

const mine = (id: string, accountId: string): MyMembershipSnapshot => ({
  membershipId: id as MembershipId,
  accountId: accountId as AccountId,
  accountKind: 'customer',
  accountStatus: 'active',
  accountName: null,
});

const notUsed = async () => {
  throw new Error('not exercised by the switcher suite');
};

const makeWorld = (myMemberships: ReadonlyArray<MyMembershipSnapshot>) => {
  const switched: Array<{ expiresAt: string; event: AccessSessionSwitched }> =
    [];
  const useCases = makeAccessMembersUseCases({
    members: {
      listMembers: notUsed,
      removeMember: notUsed,
      listMembershipsByUser: async () => myMemberships,
      switchSession: async (_sessionId, _to, expiresAt, event) => {
        switched.push({ expiresAt, event });
      },
    },
    accounts: {
      findAccount: notUsed,
      findMembership: notUsed,
      countAccountAdmins: notUsed,
    },
    sessionPolicies: {
      loadSessionPolicies: async () => ACCESS_SESSION_POLICY_DEFAULTS,
    },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  });
  return { useCases, switched };
};

describe('memberships.mine + session.switch-account', () => {
  // the actor's own membership is membership-1 on acct-1 (testAccessActor)
  const twoOrgs = [
    mine('membership-1', 'acct-1'),
    mine('membership-2', 'acct-2'),
  ];

  it('lists the caller memberships without requiring any permission', async () => {
    const world = makeWorld(twoOrgs);
    const r = await world.useCases.listMyMemberships({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
    });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.value.map((m) => m.accountId)).toEqual(['acct-1', 'acct-2']);
  });

  it('switches the session to another of YOUR memberships, audited', async () => {
    const world = makeWorld(twoOrgs);
    const r = await world.useCases.switchAccount({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      membershipId: 'membership-2',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.accountId).toBe('acct-2');
    expect(world.switched[0]?.event).toMatchObject({
      type: 'session.switched',
      sessionId: 'session-1',
      fromMembershipId: 'membership-1',
      toMembershipId: 'membership-2',
    });
    // customer policy, idle restarted at NOW (12:00), login anchored at 11:00
    expect(world.switched[0]?.expiresAt).toBe('2026-06-10T12:00:00.000Z');
  });

  it('is a no-op when switching to the current membership', async () => {
    const world = makeWorld(twoOrgs);
    const r = await world.useCases.switchAccount({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      membershipId: 'membership-1',
    });
    expect(r.ok).toBe(true);
    expect(world.switched).toHaveLength(0);
  });

  it("404s a membership that is not the caller's, even if it exists", async () => {
    const world = makeWorld(twoOrgs);
    const r = await world.useCases.switchAccount({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      membershipId: 'membership-foreign',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/membership-not-found');
  });
});
