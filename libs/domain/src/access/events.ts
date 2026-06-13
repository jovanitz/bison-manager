import type { AccessPermission } from './permission';
import type { AccessSessionPolicies } from './session/session-policy';
import type {
  AccessAction,
  AccessGrantId,
  AccountId,
  InvitationId,
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

/** A disabled account was re-enabled (the undo of account.disabled). Its
 * sessions were never touched: whatever has not expired resumes working —
 * idle TTLs keep running in real time, so long suspensions die naturally. */
export type AccessAccountEnabled = {
  readonly type: 'account.enabled';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

/** A customer account became staff: strict session policy, never listed in
 * the customer directory (and therefore never impersonable) again. */
export type AccessAccountPromoted = {
  readonly type: 'account.promoted';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
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

/** An email was invited to join an EXISTING account with given permissions. */
export type AccessInvitationCreated = {
  readonly type: 'invitation.created';
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly email: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly actorMembershipId: MembershipId;
  readonly expiresAt: string;
  readonly occurredAt: string;
};

/** The invited email signed in: membership attached to the inviting account. */
export type AccessInvitationAccepted = {
  readonly type: 'invitation.accepted';
  readonly invitationId: InvitationId;
  readonly accountId: AccountId;
  readonly membershipId: MembershipId;
  readonly userId: UserId;
  readonly occurredAt: string;
};

/** A membership was removed from its account: sessions die with it in the
 * same transaction; the user's OTHER memberships are untouched. */
export type AccessMemberRemoved = {
  readonly type: 'member.removed';
  readonly membershipId: MembershipId;
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

/** A user re-bound their session to ANOTHER of their own memberships (the
 * organization switcher). Expiry is recomputed under the target account's
 * policy; the absolute-lifetime clock stays anchored at the original login. */
export type AccessSessionSwitched = {
  readonly type: 'session.switched';
  readonly sessionId: SessionId;
  readonly fromMembershipId: MembershipId;
  readonly toMembershipId: MembershipId;
  readonly occurredAt: string;
};

/** Session-policy reconfiguration (settings.update) with full before/after. */
export type AccessSettingsUpdated = {
  readonly type: 'settings.updated';
  readonly actorMembershipId: MembershipId;
  readonly before: AccessSessionPolicies;
  readonly after: AccessSessionPolicies;
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
  | AccessAccountEnabled
  | AccessAccountPromoted
  | AccessPermissionsUpdated
  | AccessSessionRevoked
  | AccessImpersonationStarted
  | AccessImpersonationEnded
  | AccessGrantExpired
  | AccessInvitationCreated
  | AccessInvitationAccepted
  | AccessMemberRemoved
  | AccessSessionSwitched
  | AccessSettingsUpdated
  | AccessOwnerBootstrapped;

export type AccessAuditEventType = AccessAuditEvent['type'];

/** Runtime catalogue of the union above (kept exhaustive by the check below). */
export const ACCESS_AUDIT_EVENT_TYPES = [
  'login.succeeded',
  'login.failed',
  'account.disabled',
  'account.enabled',
  'account.promoted',
  'permissions.updated',
  'session.revoked',
  'impersonation.started',
  'impersonation.ended',
  'grant.expired',
  'invitation.created',
  'invitation.accepted',
  'member.removed',
  'session.switched',
  'settings.updated',
  'owner.bootstrapped',
] as const satisfies ReadonlyArray<AccessAuditEventType>;

type MissingAuditEventType = Exclude<
  AccessAuditEventType,
  (typeof ACCESS_AUDIT_EVENT_TYPES)[number]
>;
// Compile-time exhaustiveness: adding an event type without listing it here
// turns `MissingAuditEventType` non-never and this line stops compiling.
const auditEventTypesAreExhaustive: MissingAuditEventType extends never
  ? true
  : never = true;
void auditEventTypesAreExhaustive;
