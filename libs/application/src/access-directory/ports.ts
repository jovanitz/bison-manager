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

/**
 * An "orphan" / zombie identity: it exists in the auth provider but belongs to
 * NO account (no membership) — a sign-up that never onboarded, or a legacy
 * artifact. Surfaced read-only for platform cleanup; never a real actor (it
 * holds zero permissions until it creates or joins an org).
 */
export type OrphanIdentitySummary = {
  readonly userId: string;
  readonly email: string | null;
  readonly createdAt: string;
};

export type StaffDirectory = {
  /** Every staff account, in a stable order. */
  readonly listStaff: () => Promise<ReadonlyArray<StaffAccountSummary>>;
  /**
   * Every auth identity with no membership (org-less "zombies"). Only the
   * provider-backed store can answer this; an in-memory store with no auth
   * layer returns an empty list.
   */
  readonly listOrphanIdentities: () => Promise<
    ReadonlyArray<OrphanIdentitySummary>
  >;
};
