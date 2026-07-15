import type {
  AccessAccountDisabled,
  AccessAccountEnabled,
  AccessAccountDeletionCanceled,
  AccessAccountDeletionScheduled,
  AccessAccountDemoted,
  AccessAccountPromoted,
  AccessMemberRolesAssigned,
  AccessPermission,
  AccessPermissionsUpdated,
  AccessSessionPolicy,
  AccessSessionRevoked,
  AccountId,
  AccountKind,
  AccountStatus,
  MembershipId,
  RoleId,
  SessionId,
  SessionStatus,
} from '@acme/domain';

/**
 * Administrative access mutations. Every write method takes the matching audit
 * event and MUST persist mutation + event in a single transaction — the
 * signature makes an unaudited sensitive change unrepresentable.
 */
export type AdminAccountSnapshot = {
  readonly id: AccountId;
  readonly status: AccountStatus;
  readonly kind: AccountKind;
  /** True if the account hosts the protected super-admin (root) membership. */
  readonly hostsRoot: boolean;
  /** When a scheduled deletion purges this org, or null when not scheduled. */
  readonly pendingDeletionUntil: string | null;
};

export type AdminMembershipSnapshot = {
  readonly id: MembershipId;
  readonly accountId: AccountId;
  readonly accountKind: AccountKind;
  readonly permissions: ReadonlyArray<AccessPermission>;
  /** The protected super-admin membership. */
  readonly isRoot: boolean;
  /** The account owner — protected from same-account non-owner peers. */
  readonly isAccountOwner: boolean;
};

export type AdminSessionSnapshot = {
  readonly id: SessionId;
  readonly accountId: AccountId;
  readonly status: SessionStatus;
  /** True if this session belongs to the protected super-admin. */
  readonly isRoot: boolean;
};

/** One row of the "active sessions" view: the context captured at the edge. */
export type AdminSessionDetail = {
  readonly id: SessionId;
  readonly status: SessionStatus;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly createdIp: string | null;
  readonly lastIp: string | null;
};

export type AccessAdminRepository = {
  readonly findAccount: (id: AccountId) => Promise<AdminAccountSnapshot | null>;
  readonly disableAccount: (
    id: AccountId,
    event: AccessAccountDisabled,
  ) => Promise<void>;
  readonly enableAccount: (
    id: AccountId,
    event: AccessAccountEnabled,
  ) => Promise<void>;
  readonly findMembership: (
    id: MembershipId,
  ) => Promise<AdminMembershipSnapshot | null>;
  /**
   * Replaces a membership's permissions atomically with its audit event. When
   * `requireCoAdmin` is set, the account's administrators (memberships holding
   * `permissions.update`) are locked and counted INSIDE the same transaction;
   * if removing this one would leave the account with no administrator, the
   * change is refused — returns `{ orphaned: true }` and nothing is written.
   * This closes the check-then-act race two concurrent demotions would open.
   */
  readonly updatePermissions: (
    id: MembershipId,
    permissions: ReadonlyArray<AccessPermission>,
    event: AccessPermissionsUpdated,
    requireCoAdmin: boolean,
  ) => Promise<{ readonly orphaned: boolean }>;
  /**
   * Replace a membership's role assignment (ADR-0011/0014) atomically with its
   * audit event. The roles are validated by the use case (existence + account
   * coherence). Anti-orphan: in the roles-only model, assignment is how admin is
   * granted/revoked, so the write is refused — `{ orphaned: true }`, nothing
   * written — when it would strip the account's LAST administrator (the target
   * was the sole `permissions.update` holder and the new roles drop it),
   * verified under the same locked count as the other mutations.
   */
  readonly assignRoles: (
    id: MembershipId,
    roleIds: ReadonlyArray<RoleId>,
    event: AccessMemberRolesAssigned,
  ) => Promise<{ readonly orphaned: boolean }>;
  /**
   * customer → staff, atomically with the audit event AND the clamp of the
   * account's live sessions to the (stricter) staff policy. A promoted
   * account disappears from the customer directory at the same instant.
   */
  readonly promoteAccountToStaff: (
    id: AccountId,
    event: AccessAccountPromoted,
    staffPolicy: AccessSessionPolicy,
  ) => Promise<void>;
  /**
   * staff → customer, the inverse of promotion, atomically with the audit event.
   * STRIPS every membership's roles in the same transaction — a customer account
   * may not hold `any`-scoped or staff-only permissions, so leaving them would be
   * a privilege the demotion is meant to remove. Sessions re-bind to the customer
   * policy; the account reappears in the customer directory.
   */
  readonly demoteAccountToCustomer: (
    id: AccountId,
    event: AccessAccountDemoted,
    customerPolicy: AccessSessionPolicy,
  ) => Promise<void>;
  /** Marks an org for deletion (purge at `purgeAt`), reversible until then. */
  readonly scheduleAccountDeletion: (
    id: AccountId,
    purgeAt: string,
    event: AccessAccountDeletionScheduled,
  ) => Promise<void>;
  /** Withdraws a scheduled deletion; the org is fully active again. */
  readonly cancelAccountDeletion: (
    id: AccountId,
    event: AccessAccountDeletionCanceled,
  ) => Promise<void>;
  readonly findSession: (id: SessionId) => Promise<AdminSessionSnapshot | null>;
  readonly revokeSession: (
    id: SessionId,
    event: AccessSessionRevoked,
  ) => Promise<void>;
  /**
   * "Log out everywhere": revokes every active session of a membership,
   * writing one session.revoked audit event per session in the same
   * transaction. Returns how many were revoked.
   */
  readonly revokeAllSessions: (
    membershipId: MembershipId,
    template: {
      readonly actorMembershipId: MembershipId;
      readonly occurredAt: string;
    },
  ) => Promise<number>;
  /** Sessions of a membership with their edge context, newest activity first. */
  readonly listSessions: (
    membershipId: MembershipId,
  ) => Promise<ReadonlyArray<AdminSessionDetail>>;
};
