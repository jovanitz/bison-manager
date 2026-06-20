import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { AccountId } from '@acme/domain';
import type { CustomerDirectory } from '../impersonation/ports';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { makeAccessDirectoryUseCases } from './use-cases';
import type {
  OrphanIdentitySummary,
  StaffAccountSummary,
  StaffDirectory,
} from './ports';

const STAFF: ReadonlyArray<StaffAccountSummary> = [
  {
    accountId: 'acct-owner' as AccountId,
    email: 'owner@acme.test',
    displayName: 'Owner',
  },
  {
    accountId: 'acct-support' as AccountId,
    email: 'support@acme.test',
    displayName: null,
  },
];

const makeWorld = (input?: {
  staff?: ReadonlyArray<StaffAccountSummary>;
  orphans?: ReadonlyArray<OrphanIdentitySummary>;
}) => {
  let staffCalls = 0;
  const customerQueries: string[] = [];
  const staffDirectory: StaffDirectory = {
    listStaff: async () => {
      staffCalls += 1;
      return input?.staff ?? STAFF;
    },
    listOrphanIdentities: async () => input?.orphans ?? [],
  };
  const customers: CustomerDirectory = {
    search: async (query) => {
      customerQueries.push(query);
      return [
        {
          accountId: 'acct-cust' as AccountId,
          displayName: 'Casa',
          email: null,
        },
      ];
    },
    read: async () => null,
  };
  return {
    useCases: makeAccessDirectoryUseCases({
      staffDirectory,
      customers,
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    }),
    calls: () => staffCalls,
    customerQueries: () => customerQueries,
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
  it('lists every customer (empty query) for a customer.search holder', async () => {
    const world = makeWorld();
    const result = await world.useCases.listCustomers({
      actor: testAccessActor({ preset: 'owner' }),
    });
    expect(result.ok).toBe(true);
    expect(world.customerQueries()).toEqual(['']);
  });

  it('denies a plain customer without touching the directory', async () => {
    const world = makeWorld();
    const result = await world.useCases.listCustomers({
      actor: testAccessActor({ preset: 'customer' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
    expect(world.customerQueries()).toEqual([]);
  });
});
