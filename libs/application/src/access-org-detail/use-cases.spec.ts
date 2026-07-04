import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { AccountId, MembershipId, UserId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makeAccessOrgDetailUseCases } from './use-cases';
import type { OrgAdminSummary, OrgDetailReader, OrgMemberEntry } from './ports';

const ORG_ID = 'org-11';

const ORG: OrgAdminSummary = {
  accountId: ORG_ID as AccountId,
  name: 'Clínica Norte',
  email: 'admin@norte.mx',
  status: 'active',
  createdAt: TEST_ACCESS_NOW,
};

const MEMBERS: ReadonlyArray<OrgMemberEntry> = [
  {
    membershipId: 'mem-1' as MembershipId,
    userId: 'user-a' as UserId,
    displayName: 'Lucía Fuentes',
    email: 'lucia@norte.mx',
    roleNames: ['Owner'],
    isAccountOwner: true,
    isRoot: false,
    blocked: false,
  },
];

const makeWorld = (input?: { summary?: OrgAdminSummary | null }) => {
  let summaryReads = 0;
  let memberReads = 0;
  const orgs: OrgDetailReader = {
    readSummary: async () => {
      summaryReads += 1;
      return input?.summary === undefined ? ORG : input.summary;
    },
    listMembers: async () => {
      memberReads += 1;
      return MEMBERS;
    },
  };
  return {
    useCases: makeAccessOrgDetailUseCases({
      orgs,
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    }),
    summaryReads: () => summaryReads,
    memberReads: () => memberReads,
  };
};

describe('getOrgSummary', () => {
  it('returns the org metadata to a customer.search holder (owner, support)', async () => {
    for (const preset of ['owner', 'support'] as const) {
      const world = makeWorld();
      const result = await world.useCases.getOrgSummary({
        actor: testAccessActor({ preset }),
        accountId: ORG_ID,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual(ORG);
    }
  });

  it('denies actors without customer.search and never touches the reader', async () => {
    for (const preset of ['customer', 'customer-admin'] as const) {
      const world = makeWorld();
      const result = await world.useCases.getOrgSummary({
        actor: testAccessActor({ preset }),
        accountId: ORG_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
      expect(world.summaryReads()).toBe(0);
    }
  });

  it('reports an unknown account as not-found', async () => {
    const world = makeWorld({ summary: null });
    const result = await world.useCases.getOrgSummary({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: ORG_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/account-not-found');
  });
});

describe('listOrgMembers', () => {
  it('returns the roster to staff (members.read: any) for any org', async () => {
    const world = makeWorld();
    const result = await world.useCases.listOrgMembers({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: ORG_ID,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(MEMBERS);
  });

  it('lets an org admin (members.read: own) read THEIR OWN org', async () => {
    const world = makeWorld();
    const result = await world.useCases.listOrgMembers({
      actor: testAccessActor({ preset: 'customer-admin', accountId: ORG_ID }),
      accountId: ORG_ID,
    });
    expect(result.ok).toBe(true);
  });

  it('denies an org admin reading a DIFFERENT org (own scope)', async () => {
    const world = makeWorld();
    const result = await world.useCases.listOrgMembers({
      actor: testAccessActor({ preset: 'customer-admin', accountId: 'org-99' }),
      accountId: ORG_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
    expect(world.memberReads()).toBe(0);
  });

  it('denies actors without members.read (support, plain customer)', async () => {
    for (const preset of ['support', 'customer'] as const) {
      const world = makeWorld();
      const result = await world.useCases.listOrgMembers({
        actor: testAccessActor({ preset }),
        accountId: ORG_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
      expect(world.memberReads()).toBe(0);
    }
  });
});
