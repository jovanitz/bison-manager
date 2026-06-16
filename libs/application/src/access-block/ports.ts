import type {
  AccessBlocked,
  AccessUnblocked,
  AccountId,
  MembershipId,
} from '@acme/domain';

/**
 * Soft-block persistence: a blocked subject still authenticates, but every
 * permission/grant-gated operation is denied (the policy reads the resolved
 * actor's `blocked` flag). Each write pairs the state change with its audit
 * event so the adapter commits them atomically.
 */
export type AccessBlockStore = {
  readonly isOrgBlocked: (accountId: AccountId) => Promise<boolean>;
  readonly setOrgBlocked: (
    accountId: AccountId,
    blocked: boolean,
    event: AccessBlocked | AccessUnblocked,
  ) => Promise<void>;
  readonly isIdentityBlocked: (userId: string) => Promise<boolean>;
  readonly setIdentityBlocked: (
    userId: string,
    blocked: boolean,
    event: AccessBlocked | AccessUnblocked,
  ) => Promise<void>;
  /** True if the user owns the protected super-admin (root) membership. */
  readonly isIdentityRoot: (userId: string) => Promise<boolean>;
  /** One membership's block flag — an org admin's own-scope soft block. */
  readonly isMembershipBlocked: (
    membershipId: MembershipId,
  ) => Promise<boolean>;
  readonly setMembershipBlocked: (
    membershipId: MembershipId,
    blocked: boolean,
    event: AccessBlocked | AccessUnblocked,
  ) => Promise<void>;
};
