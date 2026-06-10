import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import type {
  AccessAuditEvent,
  AccessGrant,
  AccessGrantId,
  AccountId,
} from '@acme/domain';
import { TEST_ACCESS_NOW } from '../access/testing';
import type { CustomerAccountDetails } from './ports';

/** Spec fixtures for the impersonation module (test-only by convention). */
export const testCustomerAccount = (
  accountId: string,
): CustomerAccountDetails => ({
  accountId: accountId as AccountId,
  displayName: `Customer ${accountId}`,
  email: `${accountId}@example.com`,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const testImpersonationWorld = (
  customers: CustomerAccountDetails[] = [],
) => {
  const grants = new Map<string, AccessGrant>();
  const audit: AccessAuditEvent[] = [];
  const directory = new Map(customers.map((c) => [c.accountId, c]));
  return {
    grants,
    audit,
    deps: {
      grants: {
        findById: async (id: AccessGrantId) => grants.get(id) ?? null,
        saveNew: async (grant: AccessGrant, event: AccessAuditEvent) => {
          grants.set(grant.id, grant);
          audit.push(event);
        },
        saveEnded: async (grant: AccessGrant, event: AccessAuditEvent) => {
          grants.set(grant.id, grant);
          audit.push(event);
        },
      },
      customers: {
        search: async (query: string) =>
          [...directory.values()].filter((c) => c.displayName.includes(query)),
        read: async (accountId: AccountId) => directory.get(accountId) ?? null,
      },
      clock: fixedClock(new Date(TEST_ACCESS_NOW)),
      ids: sequentialIdGenerator('grant'),
    },
  };
};
