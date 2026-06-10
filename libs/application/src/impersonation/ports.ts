import type {
  AccessGrant,
  AccessGrantId,
  AccessImpersonationEnded,
  AccessImpersonationStarted,
  AccountId,
} from '@acme/domain';

/**
 * Grant persistence. Both writes pair the mutation with its audit event so the
 * adapter can commit them in one transaction.
 */
export type AccessGrantRepository = {
  readonly findById: (id: AccessGrantId) => Promise<AccessGrant | null>;
  readonly saveNew: (
    grant: AccessGrant,
    event: AccessImpersonationStarted,
  ) => Promise<void>;
  readonly saveEnded: (
    grant: AccessGrant,
    event: AccessImpersonationEnded,
  ) => Promise<void>;
};

/**
 * Read-side directory of customer accounts, for support workflows. Pure
 * queries — no audit parameter — but every call sits behind a policy check
 * (`customer.search` / `customer.read`) in the use cases.
 */
export type CustomerAccountSummary = {
  readonly accountId: AccountId;
  readonly displayName: string;
  readonly email: string | null;
};

export type CustomerAccountDetails = CustomerAccountSummary & {
  readonly status: string;
  readonly createdAt: string;
};

export type CustomerDirectory = {
  readonly search: (
    query: string,
  ) => Promise<ReadonlyArray<CustomerAccountSummary>>;
  readonly read: (
    accountId: AccountId,
  ) => Promise<CustomerAccountDetails | null>;
};
