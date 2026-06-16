import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { AccountId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makeAccessBlockUseCases } from './use-cases';

const ACCT = '00000000-0000-4000-8000-0000000000a1';
const ROOT_ACCT = '00000000-0000-4000-8000-0000000000a2';
const USER = '00000000-0000-4000-8000-0000000000b1';
const ROOT_USER = '00000000-0000-4000-8000-0000000000b2';

// Memberships for the per-membership block tests. The actor (customer-admin)
// lives in `acct-1` as `membership-1`; own-scope block only reaches its account.
const MEMBER_SAME_ORG = 'membership-2';
const MEMBER_OTHER_ORG = 'membership-3';
const MEMBER_ROOT = 'membership-root';
const memberships: Record<
  string,
  { accountId: string; isRoot: boolean } | undefined
> = {
  [MEMBER_SAME_ORG]: { accountId: 'acct-1', isRoot: false },
  [MEMBER_OTHER_ORG]: { accountId: 'acct-other', isRoot: false },
  [MEMBER_ROOT]: { accountId: 'acct-1', isRoot: true },
  'membership-1': { accountId: 'acct-1', isRoot: false }, // the actor's own
};

const makeWorld = (input?: { orgBlocked?: boolean }) => {
  const calls: Array<{ kind: string; id: string; blocked: boolean }> = [];
  let orgBlocked = input?.orgBlocked ?? false;
  const blockedIdentities = new Set<string>();
  const blockedMemberships = new Set<string>();
  const useCases = makeAccessBlockUseCases({
    blocks: {
      isOrgBlocked: async () => orgBlocked,
      setOrgBlocked: async (id, blocked) => {
        orgBlocked = blocked;
        calls.push({ kind: 'org', id, blocked });
      },
      isIdentityBlocked: async (userId) => blockedIdentities.has(userId),
      setIdentityBlocked: async (id, blocked) => {
        if (blocked) blockedIdentities.add(id);
        else blockedIdentities.delete(id);
        calls.push({ kind: 'identity', id, blocked });
      },
      isIdentityRoot: async (userId) => userId === ROOT_USER,
      isMembershipBlocked: async (id) => blockedMemberships.has(id),
      setMembershipBlocked: async (id, blocked) => {
        if (blocked) blockedMemberships.add(id);
        else blockedMemberships.delete(id);
        calls.push({ kind: 'membership', id, blocked });
      },
    },
    accounts: {
      findAccount: async (id) => ({
        id,
        status: 'active',
        kind: 'customer',
        hostsRoot: id === (ROOT_ACCT as AccountId),
      }),
      findMembership: async (id) => {
        const m = memberships[id];
        return m
          ? {
              id,
              accountId: m.accountId as AccountId,
              accountKind: 'customer' as const,
              permissions: [],
              isRoot: m.isRoot,
            }
          : null;
      },
    },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  });
  return { useCases, calls };
};

describe('access block use cases', () => {
  it('blocks an org for an authorized actor', async () => {
    const world = makeWorld();
    const r = await world.useCases.blockOrg({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: ACCT,
      reason: 'non-payment',
    });
    expect(r.ok).toBe(true);
    expect(world.calls).toEqual([{ kind: 'org', id: ACCT, blocked: true }]);
  });

  it('is idempotent — re-blocking an already-blocked org emits no event', async () => {
    const world = makeWorld({ orgBlocked: true });
    const r = await world.useCases.blockOrg({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: ACCT,
    });
    expect(r.ok).toBe(true);
    expect(world.calls).toEqual([]);
  });

  it('denies an actor without access.block', async () => {
    const world = makeWorld();
    const r = await world.useCases.blockOrg({
      actor: testAccessActor({ preset: 'support' }),
      accountId: ACCT,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });

  it('refuses to block the super-admin’s org or identity (root protected)', async () => {
    const world = makeWorld();
    const actor = testAccessActor({ preset: 'owner', isRoot: false });

    const org = await world.useCases.blockOrg({ actor, accountId: ROOT_ACCT });
    expect(org.ok).toBe(false);
    if (!org.ok) expect(org.error.tag).toBe('app/access-denied');

    const identity = await world.useCases.blockIdentity({
      actor,
      userId: ROOT_USER,
    });
    expect(identity.ok).toBe(false);
    expect(world.calls).toEqual([]);
  });

  it('blocks and unblocks an identity', async () => {
    const world = makeWorld();
    const actor = testAccessActor({ preset: 'owner' });
    await world.useCases.blockIdentity({ actor, userId: USER });
    await world.useCases.unblockIdentity({ actor, userId: USER });
    expect(world.calls).toEqual([
      { kind: 'identity', id: USER, blocked: true },
      { kind: 'identity', id: USER, blocked: false },
    ]);
  });

  it('lets an org admin block + unblock a member of their OWN org', async () => {
    const world = makeWorld();
    const actor = testAccessActor({ preset: 'customer-admin' });
    const blocked = await world.useCases.blockMember({
      actor,
      membershipId: MEMBER_SAME_ORG,
      reason: 'abuse',
    });
    expect(blocked.ok).toBe(true);
    const unblocked = await world.useCases.unblockMember({
      actor,
      membershipId: MEMBER_SAME_ORG,
    });
    expect(unblocked.ok).toBe(true);
    expect(world.calls).toEqual([
      { kind: 'membership', id: MEMBER_SAME_ORG, blocked: true },
      { kind: 'membership', id: MEMBER_SAME_ORG, blocked: false },
    ]);
  });

  it('refuses to block a member of ANOTHER org (own scope only)', async () => {
    const world = makeWorld();
    const r = await world.useCases.blockMember({
      actor: testAccessActor({ preset: 'customer-admin' }),
      membershipId: MEMBER_OTHER_ORG,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    expect(world.calls).toEqual([]);
  });

  it('refuses to block the super-admin membership', async () => {
    const world = makeWorld();
    const r = await world.useCases.blockMember({
      actor: testAccessActor({ preset: 'customer-admin' }),
      membershipId: MEMBER_ROOT,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    expect(world.calls).toEqual([]);
  });

  it('refuses to block your OWN membership (no self-lockout)', async () => {
    const world = makeWorld();
    const r = await world.useCases.blockMember({
      actor: testAccessActor({ preset: 'customer-admin' }),
      membershipId: 'membership-1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    expect(world.calls).toEqual([]);
  });

  it('denies a plain customer (no members.block) blocking a member', async () => {
    const world = makeWorld();
    const r = await world.useCases.blockMember({
      actor: testAccessActor({ preset: 'customer' }),
      membershipId: MEMBER_SAME_ORG,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    expect(world.calls).toEqual([]);
  });
});
