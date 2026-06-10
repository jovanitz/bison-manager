import type { AccessPermission } from './permission';
import type {
  AccessAction,
  AccessGrantId,
  AccountId,
  MembershipId,
  SessionId,
  UserId,
} from './value-objects';

/**
 * Audit events — the security-relevant facts the system must never lose.
 *
 * These are pure domain data. Sensitive write operations accept the matching
 * event as a parameter so the adapter can persist mutation + audit record in
 * one transaction; an unaudited sensitive action is unrepresentable by design.
 */
export type AccessLoginSucceeded = {
  readonly type: 'login.succeeded';
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly occurredAt: string;
};

export type AccessLoginFailed = {
  readonly type: 'login.failed';
  readonly attemptedIdentifier: string;
  readonly occurredAt: string;
};

export type AccessAccountDisabled = {
  readonly type: 'account.disabled';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly reason: string | null;
  readonly occurredAt: string;
};

export type AccessPermissionsUpdated = {
  readonly type: 'permissions.updated';
  readonly membershipId: MembershipId;
  readonly actorMembershipId: MembershipId;
  readonly before: ReadonlyArray<AccessPermission>;
  readonly after: ReadonlyArray<AccessPermission>;
  readonly occurredAt: string;
};

export type AccessSessionRevoked = {
  readonly type: 'session.revoked';
  readonly sessionId: SessionId;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

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

/** Emitted once, by the documented env-driven bootstrap (see docs). */
export type AccessOwnerBootstrapped = {
  readonly type: 'owner.bootstrapped';
  readonly membershipId: MembershipId;
  readonly userId: UserId;
  readonly occurredAt: string;
};

export type AccessAuditEvent =
  | AccessLoginSucceeded
  | AccessLoginFailed
  | AccessAccountDisabled
  | AccessPermissionsUpdated
  | AccessSessionRevoked
  | AccessImpersonationStarted
  | AccessImpersonationEnded
  | AccessGrantExpired
  | AccessOwnerBootstrapped;

export type AccessAuditEventType = AccessAuditEvent['type'];
