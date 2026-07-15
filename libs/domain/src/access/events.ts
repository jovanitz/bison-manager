import type { AccessPermission } from './permission';
import type { AccessSessionPolicies } from './session/session-policy';
import type {
  AccountId,
  MembershipId,
  RoleId,
  SessionId,
  UserId,
} from './value-objects';
import type {
  AccessGrantExpired,
  AccessImpersonationEnded,
  AccessImpersonationStarted,
} from './grant/grant-events';
import type {
  AccessInvitationAccepted,
  AccessInvitationCreated,
  AccessInvitationRevoked,
} from './invitation/invitation-events';

export type {
  AccessGrantExpired,
  AccessImpersonationEnded,
  AccessImpersonationStarted,
} from './grant/grant-events';

export type {
  AccessInvitationAccepted,
  AccessInvitationCreated,
  AccessInvitationRevoked,
} from './invitation/invitation-events';

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

/** A membership's role assignment was replaced (ADR-0011). `roleIds` is the new
 * full set; effective permissions are direct ∪ expand(roleIds) at resolution. */
export type AccessMemberRolesAssigned = {
  readonly type: 'member.roles-assigned';
  readonly membershipId: MembershipId;
  readonly actorMembershipId: MembershipId;
  readonly roleIds: ReadonlyArray<RoleId>;
  readonly occurredAt: string;
};

export type AccessSessionRevoked = {
  readonly type: 'session.revoked';
  readonly sessionId: SessionId;
  readonly actorMembershipId: MembershipId;
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

/** What a soft block targets: a whole org, one identity across every org, or a
 * single membership (one user inside one org — the org admin's own scope). */
export type AccessBlockSubjectKind = 'org' | 'identity' | 'membership';

/**
 * Soft block / unblock of a subject — an org (account), an identity (user), or
 * a single membership. Blocked subjects keep authenticating (login +
 * self-service reads) but every permission/grant-gated operation is denied.
 * `subjectId` is the account id (`org`), the user id (`identity`) or the
 * membership id (`membership`).
 */
export type AccessBlocked = {
  readonly type: 'access.blocked';
  readonly subjectKind: AccessBlockSubjectKind;
  readonly subjectId: string;
  readonly actorMembershipId: MembershipId;
  readonly reason: string | null;
  readonly occurredAt: string;
};

export type AccessUnblocked = {
  readonly type: 'access.unblocked';
  readonly subjectKind: AccessBlockSubjectKind;
  readonly subjectId: string;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

export type AccessAuditEvent =
  | AccessLoginSucceeded
  | AccessLoginFailed
  | AccessAccountDisabled
  | AccessAccountEnabled
  | AccessAccountPromoted
  | AccessPermissionsUpdated
  | AccessMemberRolesAssigned
  | AccessSessionRevoked
  | AccessImpersonationStarted
  | AccessImpersonationEnded
  | AccessGrantExpired
  | AccessInvitationCreated
  | AccessInvitationAccepted
  | AccessInvitationRevoked
  | AccessMemberRemoved
  | AccessSessionSwitched
  | AccessSettingsUpdated
  | AccessOwnerBootstrapped
  | AccessBlocked
  | AccessUnblocked;

export type AccessAuditEventType = AccessAuditEvent['type'];

/** Runtime catalogue of the union above (kept exhaustive by the check below). */
export const ACCESS_AUDIT_EVENT_TYPES = [
  'login.succeeded',
  'login.failed',
  'account.disabled',
  'account.enabled',
  'account.promoted',
  'permissions.updated',
  'member.roles-assigned',
  'session.revoked',
  'impersonation.started',
  'impersonation.ended',
  'grant.expired',
  'invitation.created',
  'invitation.accepted',
  'invitation.revoked',
  'member.removed',
  'session.switched',
  'settings.updated',
  'owner.bootstrapped',
  'access.blocked',
  'access.unblocked',
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
