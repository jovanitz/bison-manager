import type { CustomerDirectory, StaffDirectory } from '@acme/application';
import type { AccountId } from '@acme/domain';
import type { AccessStoreState } from './access-seed';

/**
 * Security invariant (see the impersonation use cases): only customer accounts
 * are ever visible here. A staff account surfacing in this directory would
 * become an impersonation target for support.
 */
export const makeInMemoryCustomerDirectory = (
  state: AccessStoreState,
): CustomerDirectory => ({
  search: async (query) => {
    const needle = query.toLowerCase();
    return [...state.customers.values()]
      .filter(
        (c) =>
          c.displayName.toLowerCase().includes(needle) ||
          (c.email ?? '').toLowerCase().includes(needle),
      )
      .map(({ accountId, displayName, email }) => ({
        accountId,
        displayName,
        email,
      }));
  },
  read: async (accountId) => state.customers.get(accountId) ?? null,
});

/** The membership behind an account — a staff account holds exactly one. */
const membershipOf = (state: AccessStoreState, accountId: string) =>
  [...state.memberships.values()].find((m) => m.accountId === accountId);

const memberCountOf = (state: AccessStoreState, accountId: string): number =>
  [...state.memberships.values()].filter((m) => m.accountId === accountId)
    .length;

/**
 * The ADMIN directory (staff table + organizations table + zombies).
 *
 * `blocked` means different things on each side and is read from a different
 * place on purpose: a STAFF row is blocked when its IDENTITY is (`identity.block`
 * keys off `userId`, a different id space than `accountId`), an ORG row when the
 * ACCOUNT is (`org.block`). In-memory accounts carry no name/email columns, so
 * staff name/email surface as null; the Postgres adapter reads the real values.
 */
export const makeInMemoryStaffDirectory = (
  state: AccessStoreState,
): StaffDirectory => ({
  listStaff: async () =>
    [...state.accounts.entries()]
      .filter(([id]) => !state.customers.has(id))
      .map(([id, account]) => {
        const membership = membershipOf(state, id);
        const userId = membership?.userId ?? '';
        return {
          accountId: id as AccountId,
          userId,
          email: null,
          displayName: null,
          blocked: state.blockedIdentities.has(userId),
          disabled: account.status === 'disabled',
          isRoot: membership?.isRoot ?? false,
        };
      }),

  // No auth layer in memory, so nothing can be orphaned from it.
  listOrphanIdentities: async () => [],

  listCustomerAccounts: async () =>
    [...state.customers.values()].map((customer) => {
      const account = state.accounts.get(customer.accountId);
      return {
        accountId: customer.accountId,
        displayName: customer.displayName,
        email: customer.email,
        blocked: account?.blocked ?? false,
        disabled: account?.status === 'disabled',
        memberCount: memberCountOf(state, customer.accountId),
      };
    }),
});
