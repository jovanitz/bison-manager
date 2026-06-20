import type {
  AccessAction,
  AccessGrantId,
  AccountId,
  MembershipId,
} from '../value-objects';

/**
 * Audit events for impersonation grants (their home next to the grant entity).
 * Re-exported from `../events`, where they join the `AccessAuditEvent` union.
 */
export type AccessImpersonationStarted = {
  readonly type: 'impersonation.started';
  readonly grantId: AccessGrantId;
  readonly actorMembershipId: MembershipId;
  readonly targetAccountId: AccountId;
  readonly reason: string;
  readonly actions: ReadonlyArray<AccessAction>;
  readonly expiresAt: string;
  readonly occurredAt: string;
};

export type AccessImpersonationEnded = {
  readonly type: 'impersonation.ended';
  readonly grantId: AccessGrantId;
  readonly actorMembershipId: MembershipId;
  readonly targetAccountId: AccountId;
  readonly occurredAt: string;
};

export type AccessGrantExpired = {
  readonly type: 'grant.expired';
  readonly grantId: AccessGrantId;
  readonly membershipId: MembershipId;
  readonly targetAccountId: AccountId;
  readonly occurredAt: string;
};
