import type {
  AccessMemberRemoved,
  AccessPermission,
  AccessSessionSwitched,
  AccountId,
  AccountKind,
  AccountStatus,
  MembershipId,
  RoleId,
  SessionId,
  UserId,
} from '@acme/domain';

/**
 * Member management of one account (organization). This is the surface an
 * organization admin uses on their OWN account (own scope) and platform staff
 * uses on any account — same use cases, different permission scope.
 */
export type AccessMemberSnapshot = {
  readonly membershipId: MembershipId;
  readonly userId: UserId;
  readonly permissions: ReadonlyArray<AccessPermission>;
  /** Assigned role ids (ADR-0011); unioned into permissions at resolution. */
  readonly roleIds: ReadonlyArray<RoleId>;
  /** The protected super-admin membership — the UI hides editing it. */
  readonly isRoot: boolean;
  /** Soft-blocked within this org (own-scope `members.block`). */
  readonly blocked: boolean;
};

/** One entry of a user's organization switcher. */
export type MyMembershipSnapshot = {
  readonly membershipId: MembershipId;
  readonly accountId: AccountId;
  readonly accountKind: AccountKind;
  readonly accountStatus: AccountStatus;
  /** From the customer directory; staff accounts have no public name. */
  readonly accountName: string | null;
};

export type AccessMemberDirectory = {
  /** Every membership of the account, in stable (insertion) order. */
  readonly listMembers: (
    accountId: AccountId,
  ) => Promise<ReadonlyArray<AccessMemberSnapshot>>;
  /**
   * Removes the membership, killing its sessions in the SAME transaction
   * (refresh tokens included). The user's other memberships are untouched.
   * When `requireCoAdmin` is set, the account's administrators are locked and
   * counted in that transaction; removing the last one is refused (returns
   * `{ orphaned: true }`, nothing written) — atomic against concurrent removals.
   */
  readonly removeMember: (
    membershipId: MembershipId,
    event: AccessMemberRemoved,
    requireCoAdmin: boolean,
  ) => Promise<{ readonly orphaned: boolean }>;
  /** Every membership of one USER — the organization switcher. */
  readonly listMembershipsByUser: (
    userId: UserId,
  ) => Promise<ReadonlyArray<MyMembershipSnapshot>>;
  /** Re-binds the session to another membership + audit, one transaction. */
  readonly switchSession: (
    sessionId: SessionId,
    toMembershipId: MembershipId,
    expiresAt: string,
    event: AccessSessionSwitched,
  ) => Promise<void>;
};
