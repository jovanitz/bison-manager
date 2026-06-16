import type { AccessGrant } from './grant/grant';
import type { AccessPermission } from './permission';
import type { AccountKind } from './session/session-policy';
import type {
  AccountId,
  MembershipId,
  SessionId,
  UserId,
} from './value-objects';

/**
 * The actor: everything the policy needs to know about "who is asking",
 * resolved from *current* persisted state — never from token claims. A JWT
 * only proves identity; authorization facts (account status, session status,
 * permissions, grants) are loaded fresh so revocation takes effect immediately.
 *
 * Users relate to accounts through a membership (user × account). Today each
 * user has one membership; the shape already supports several.
 */
export type AccountStatus = 'active' | 'disabled';
export type SessionStatus = 'active' | 'revoked';

export type ActorMembership = {
  readonly id: MembershipId;
  readonly userId: UserId;
  readonly accountId: AccountId;
};

export type ActorSession = {
  readonly id: SessionId;
  readonly status: SessionStatus;
  readonly expiresAt: string;
  /** Login instant — the anchor of the absolute session-lifetime clock. */
  readonly createdAt: string;
};

export type AccessActor = {
  readonly membership: ActorMembership;
  readonly accountStatus: AccountStatus;
  /** Parametrizes session hygiene only — it never grants anything. */
  readonly accountKind: AccountKind;
  /**
   * The protected super-admin (the bootstrapped owner). It grants nothing by
   * itself — permissions still come from `permissions`. Its only effect is
   * protective: an admin mutation whose TARGET is the root is refused unless the
   * actor is the root, so no permission set, however broad, lets another member
   * disable, demote, expel, re-permission or sign out the super-admin.
   */
  readonly isRoot: boolean;
  /**
   * Soft block (org- or identity-level). A blocked actor still authenticates
   * and resolves — login and self-service reads keep working — but the policy
   * denies EVERY permission/grant-gated operation. "Can sign in, cannot
   * operate." The hard kill (account `disabled`) is separate and fails earlier.
   */
  readonly blocked: boolean;
  readonly session: ActorSession;
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly grants: ReadonlyArray<AccessGrant>;
};
