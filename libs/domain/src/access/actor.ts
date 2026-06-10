import type { AccessGrant } from './grant/grant';
import type { AccessPermission } from './permission';
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
};

export type AccessActor = {
  readonly membership: ActorMembership;
  readonly accountStatus: AccountStatus;
  readonly session: ActorSession;
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly grants: ReadonlyArray<AccessGrant>;
};
