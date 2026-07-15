import type { Result, TaggedError } from '@acme/shared';
import type { AccountId } from '@acme/domain';

/**
 * The auth provider's destructive admin surface. Separate from
 * `IdentityProvisioner` (which MINTS identities during activation) on purpose:
 * they are opposite capabilities, gated by different actions, and a port that
 * both creates and erases invites a caller to hold more power than it needs.
 */
export type IdentityPurger = {
  /** Erase an identity in the auth provider. IRREVERSIBLE. */
  readonly deleteIdentity: (
    userId: string,
  ) => Promise<Result<void, TaggedError<'app/identity-purge-failed'>>>;
};

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
  /**
   * The IDENTITY behind the staff account. Identity-scoped actions
   * (`identity.block`/`identity.unblock`) key off this, NEVER `accountId` —
   * they are different id spaces and passing one for the other blocks the
   * wrong subject.
   */
  readonly userId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  /** Soft-blocked identity: can sign in, cannot operate. */
  readonly blocked: boolean;
  /** Hard-disabled account: fails at actor resolution (401). */
  readonly disabled: boolean;
  /** Root membership (ADR-0011): protected — never demote, block or disable. */
  readonly isRoot: boolean;
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

/**
 * One customer ORG as the admin directory lists it. Deliberately NOT
 * `CustomerAccountSummary` (impersonation's search result): this is the
 * administrative row, so it carries the moderation state and the roster size
 * the directory renders. The billing plan is NOT here — it arrives per-org on
 * the coverage read (ADR-0018), which already resolves the plan.
 */
export type CustomerDirectoryEntry = {
  readonly accountId: AccountId;
  readonly displayName: string;
  readonly email: string | null;
  /** Soft-blocked org: members can sign in, cannot operate. */
  readonly blocked: boolean;
  /** Hard-disabled account. */
  readonly disabled: boolean;
  /** Members in the org — the roster size, not a permission concept. */
  readonly memberCount: number;
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
  /**
   * Every customer org with its administrative state. Distinct from
   * `CustomerDirectory.search('')`, which answers support's impersonation
   * lookup and must stay lean.
   */
  readonly listCustomerAccounts: () => Promise<
    ReadonlyArray<CustomerDirectoryEntry>
  >;
};
