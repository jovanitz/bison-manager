import type {
  AccessAccountDisabled,
  AccessPermission,
  AccessPermissionsUpdated,
  AccessSessionRevoked,
  AccountId,
  AccountStatus,
  MembershipId,
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
};

export type AdminMembershipSnapshot = {
  readonly id: MembershipId;
  readonly accountId: AccountId;
  readonly permissions: ReadonlyArray<AccessPermission>;
};

export type AdminSessionSnapshot = {
  readonly id: SessionId;
  readonly accountId: AccountId;
  readonly status: SessionStatus;
};

export type AccessAdminRepository = {
  readonly findAccount: (id: AccountId) => Promise<AdminAccountSnapshot | null>;
  readonly disableAccount: (
    id: AccountId,
    event: AccessAccountDisabled,
  ) => Promise<void>;
  readonly findMembership: (
    id: MembershipId,
  ) => Promise<AdminMembershipSnapshot | null>;
  readonly updatePermissions: (
    id: MembershipId,
    permissions: ReadonlyArray<AccessPermission>,
    event: AccessPermissionsUpdated,
  ) => Promise<void>;
  readonly findSession: (id: SessionId) => Promise<AdminSessionSnapshot | null>;
  readonly revokeSession: (
    id: SessionId,
    event: AccessSessionRevoked,
  ) => Promise<void>;
};
