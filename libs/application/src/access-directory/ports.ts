import type { AccountId } from '@acme/domain';

/**
 * Read-side directory of STAFF accounts — the platform-internal counterpart of
 * the customer `CustomerDirectory`. Unlike that one (which support uses to find
 * impersonation targets), this view exists only for platform administration:
 * it lists the people who operate the platform. Pure query — no audit
 * parameter — but every call sits behind a `staff.read` policy check in the
 * use case.
 *
 * A staff account has no public-facing display name the way a customer
 * organization does, hence both name and email are nullable here.
 */
export type StaffAccountSummary = {
  readonly accountId: AccountId;
  readonly email: string | null;
  readonly displayName: string | null;
};

export type StaffDirectory = {
  /** Every staff account, in a stable order. */
  readonly listStaff: () => Promise<ReadonlyArray<StaffAccountSummary>>;
};
