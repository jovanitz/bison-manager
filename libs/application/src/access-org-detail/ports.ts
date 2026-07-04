import type { AccountId, MembershipId, UserId } from '@acme/domain';

/**
 * Read-side for the Customer (Org) Detail dashboard screen — a directory
 * drill-down. This is ADMINISTRATIVE visibility, NOT impersonation:
 *
 * - the org summary is staff-visible metadata (gated by `customer.search`, the
 *   same permission that browses the directory — no grant);
 * - the roster is gated by `members.read` (staff `any`, an org admin `own`).
 *
 * Deeper customer DATA / acting-as the customer stays behind `customer.read`
 * (grant-only) — see the impersonation slice.
 */

/** Administrative metadata of one customer org (no grant needed). */
export type OrgAdminSummary = {
  readonly accountId: AccountId;
  readonly name: string;
  readonly email: string | null;
  /** Account lifecycle: `active` | `disabled` | `blocked`. */
  readonly status: string;
  readonly createdAt: string;
};

/**
 * One member for the admin roster — display-oriented, unlike the
 * permission-oriented `AccessMemberSnapshot`. `displayName` may be absent (the
 * screen falls back to email); `roleNames` are resolved from the membership's
 * roles.
 */
export type OrgMemberEntry = {
  readonly membershipId: MembershipId;
  readonly userId: UserId;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly roleNames: ReadonlyArray<string>;
  readonly isAccountOwner: boolean;
  readonly isRoot: boolean;
  readonly blocked: boolean;
};

/**
 * Pure read queries; every call sits behind a policy check in the use case
 * (`customer.search` for the summary, `members.read` for the roster).
 */
export type OrgDetailReader = {
  readonly readSummary: (
    accountId: AccountId,
  ) => Promise<OrgAdminSummary | null>;
  readonly listMembers: (
    accountId: AccountId,
  ) => Promise<ReadonlyArray<OrgMemberEntry>>;
};
