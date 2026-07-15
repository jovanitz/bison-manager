import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { AccountId } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makeAccessDirectoryUseCases } from './use-cases';
import type {
  CustomerDirectoryEntry,
  OrphanIdentitySummary,
  StaffAccountSummary,
  StaffDirectory,
} from './ports';

const STAFF: ReadonlyArray<StaffAccountSummary> = [
  {
    accountId: 'acct-owner' as AccountId,
    userId: 'user-owner',
    email: 'owner@acme.test',
    displayName: 'Owner',
    blocked: false,
    disabled: false,
    isRoot: true,
  },
  {
    accountId: 'acct-support' as AccountId,
    userId: 'user-support',
    email: 'support@acme.test',
    displayName: null,
    blocked: true,
    disabled: false,
    isRoot: false,
  },
];

const CUSTOMERS: ReadonlyArray<CustomerDirectoryEntry> = [
  {
    accountId: 'acct-cust' as AccountId,
    displayName: 'Casa',
    email: null,
    blocked: false,
    disabled: false,
    memberCount: 4,
  },
];

const makeWorld = (input?: {
  staff?: ReadonlyArray<StaffAccountSummary>;
  orphans?: ReadonlyArray<OrphanIdentitySummary>;
}) => {
  let staffCalls = 0;
  let customerCalls = 0;
  const staffDirectory: StaffDirectory = {
    listStaff: async () => {
      staffCalls += 1;
      return input?.staff ?? STAFF;
    },
    listOrphanIdentities: async () => input?.orphans ?? [],
    listCustomerAccounts: async () => {
      customerCalls += 1;
      return CUSTOMERS;
    },
  };
  return {
    useCases: makeAccessDirectoryUseCases({
      staffDirectory,
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    }),
    calls: () => staffCalls,
    customerCalls: () => customerCalls,
  };
};

describe('listStaff', () => {
  it('returns the staff directory to a platform admin (owner preset)', async () => {
    const world = makeWorld();
    const result = await world.useCases.listStaff({
      actor: testAccessActor({ preset: 'owner' }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(STAFF);
  });

  it('denies actors without staff.read and never touches the directory', async () => {
    for (const preset of ['customer', 'customer-admin', 'support'] as const) {
      const world = makeWorld();
      const result = await world.useCases.listStaff({
        actor: testAccessActor({ preset }),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
      expect(world.calls()).toBe(0);
    }
  });
});

describe('listOrphanIdentities', () => {
  const ORPHANS: ReadonlyArray<OrphanIdentitySummary> = [
    { userId: 'user-z', email: 'z@acme.test', createdAt: TEST_ACCESS_NOW },
  ];

  it('returns org-less identities to a staff.read holder', async () => {
    const world = makeWorld({ orphans: ORPHANS });
    const result = await world.useCases.listOrphanIdentities({
      actor: testAccessActor({ preset: 'owner' }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(ORPHANS);
  });

  it('denies actors without staff.read', async () => {
    for (const preset of ['customer', 'customer-admin', 'support'] as const) {
      const result = await makeWorld().useCases.listOrphanIdentities({
        actor: testAccessActor({ preset }),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
    }
  });
});

describe('listCustomers', () => {
  it('lists every customer with its ADMIN state for a customer.search holder', async () => {
    const world = makeWorld();
    const result = await world.useCases.listCustomers({
      actor: testAccessActor({ preset: 'owner' }),
    });
    expect(result.ok).toBe(true);
    expect(world.customerCalls()).toBe(1);
    // The directory row carries moderation state + roster size — not the lean
    // impersonation-search shape.
    if (result.ok)
      expect(result.value[0]).toMatchObject({
        displayName: 'Casa',
        blocked: false,
        disabled: false,
        memberCount: 4,
      });
  });

  it('denies a plain customer without touching the directory', async () => {
    const world = makeWorld();
    const result = await world.useCases.listCustomers({
      actor: testAccessActor({ preset: 'customer' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
    expect(world.customerCalls()).toBe(0);
  });
});
