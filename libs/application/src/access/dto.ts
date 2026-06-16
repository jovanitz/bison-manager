import {
  ACCESS_ACTIONS,
  ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
} from '@acme/domain';
import type {
  AccessActor,
  AccessGrant,
  AccessPermission,
  AccountStatus,
  SessionStatus,
} from '@acme/domain';

/**
 * The full catalog of authorizable actions + scopes as plain strings — what a
 * permissions editor offers in a picker. Mirrors the domain's closed action set
 * so the UI (which may not import `domain`) stays in sync automatically.
 */
export const ACCESS_ACTION_CATALOG: ReadonlyArray<string> = [...ACCESS_ACTIONS];
export const ACCESS_SCOPE_CATALOG = ['own', 'any'] as const;

/**
 * The subset of actions an organization admin (customer-admin) may delegate to
 * members of their OWN org — never `any`-scoped, never platform machinery. The
 * client's permissions editor offers only these; the server re-enforces it.
 */
export const ACCESS_DELEGABLE_ACTION_CATALOG: ReadonlyArray<string> = [
  ...ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
];

/**
 * Serializable views of the actor's access. `CurrentAccessDto` is what clients
 * use for UI gating (hide what would be denied) — enforcement itself always
 * happens server-side through the policy, never from this DTO.
 */
export type AccessPermissionDto = {
  readonly action: string;
  readonly scope: string;
};

export type AccessGrantDto = {
  readonly id: string;
  readonly kind: string;
  readonly targetAccountId: string;
  readonly actions: ReadonlyArray<string>;
  readonly reason: string;
  readonly createdAt: string;
  readonly expiresAt: string;
};

export type CurrentAccessDto = {
  readonly membershipId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly accountStatus: AccountStatus;
  /** Soft-blocked: can sign in and read this snapshot, but every action is denied. */
  readonly blocked: boolean;
  readonly session: {
    readonly id: string;
    readonly status: SessionStatus;
    readonly expiresAt: string;
  };
  readonly permissions: ReadonlyArray<AccessPermissionDto>;
  readonly activeGrants: ReadonlyArray<AccessGrantDto>;
};

export const toAccessPermissionDto = (
  permission: AccessPermission,
): AccessPermissionDto => ({
  action: permission.action,
  scope: permission.scope,
});

export const toAccessGrantDto = (grant: AccessGrant): AccessGrantDto => ({
  id: grant.id,
  kind: grant.kind,
  targetAccountId: grant.targetAccountId,
  actions: grant.actions,
  reason: grant.reason,
  createdAt: grant.createdAt,
  expiresAt: grant.expiresAt,
});

export const toCurrentAccessDto = (
  actor: AccessActor,
  activeGrants: ReadonlyArray<AccessGrant>,
): CurrentAccessDto => ({
  membershipId: actor.membership.id,
  userId: actor.membership.userId,
  accountId: actor.membership.accountId,
  accountStatus: actor.accountStatus,
  blocked: actor.blocked,
  session: {
    id: actor.session.id,
    status: actor.session.status,
    expiresAt: actor.session.expiresAt,
  },
  permissions: actor.permissions.map(toAccessPermissionDto),
  activeGrants: activeGrants.map(toAccessGrantDto),
});
