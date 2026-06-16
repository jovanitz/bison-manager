import { ok } from '@acme/shared';
import type { MyMembershipDto, OrgsUseCases } from '@acme/application';

/** Test doubles for the client screens (spec-only by convention). */
export const testMyOrgs: ReadonlyArray<MyMembershipDto> = [
  {
    membershipId: 'm-own',
    accountId: 'acct-1',
    accountKind: 'customer',
    accountStatus: 'active',
    accountName: 'My Org',
  },
  {
    membershipId: 'm-invited',
    accountId: 'acct-2',
    accountKind: 'customer',
    accountStatus: 'active',
    accountName: 'Other Org',
  },
];

export const mockOrgs = (
  overrides: Partial<OrgsUseCases> = {},
): OrgsUseCases => ({
  createOrganization: async () => ok({ accountId: 'acct-new' }),
  listMyMemberships: async () => ok(testMyOrgs),
  switchAccount: async (id) => ok({ accountId: `acct-of-${id}` }),
  ...overrides,
});
