import type { AccessActor } from '../actor';
import { accessGrantAllows } from '../grant/grant';
import { accessPermissionAllows } from '../permission';
import type { AccessResource } from '../permission';
import { GRANT_ONLY_ACTIONS } from '../value-objects';
import type { AccessAction, AccessGrantId } from '../value-objects';

/**
 * The authorization core: one pure, deterministic function. Every enforcement
 * point (use cases, the API request pipeline, future AI tools) funnels through
 * here. UI may *hide* what this would deny, but only this decides.
 *
 * Deny-by-default and fail-closed: anything not explicitly allowed by a
 * persistent permission or an active grant is denied, and a dead account or
 * session denies everything regardless of what the actor holds.
 *
 * A denial is a valid decision, not an error — hence no `Result` here.
 */
export type AccessDenialReason =
  | 'account-disabled'
  | 'session-revoked'
  | 'session-expired'
  | 'blocked'
  | 'not-permitted';

export type AccessDecision =
  | { readonly allowed: true; readonly source: 'permission' }
  | { readonly allowed: true; readonly source: 'root' }
  | { readonly allowed: true; readonly source: 'owner' }
  | {
      readonly allowed: true;
      readonly source: 'grant';
      readonly grantId: AccessGrantId;
    }
  | { readonly allowed: false; readonly reason: AccessDenialReason };

const accessDenied = (reason: AccessDenialReason): AccessDecision => ({
  allowed: false,
  reason,
});

/**
 * Ownership bypass (ADR-0011): authority from an identity flag, not a permission
 * list — so root/owner never go stale. Returns a decision to short-circuit, or
 * `null` to fall through to the permission/grant checks. Liveness gates run
 * BEFORE this, so a dead account/session/block still denies even root.
 */
const ownershipDecision = (
  actor: AccessActor,
  resource: AccessResource,
  action: AccessAction,
  grantOnlyActions: ReadonlyArray<AccessAction>,
): AccessDecision | null => {
  // Grant-only actions (customer data, ADR-0010) are never bypassable — even
  // root/owner need an audited grant, so authority never escapes the audit trail.
  if (grantOnlyActions.includes(action)) return null;
  if (actor.isRoot) return { allowed: true, source: 'root' };
  if (
    actor.isAccountOwner &&
    resource.accountId !== null &&
    resource.accountId === actor.membership.accountId
  ) {
    return { allowed: true, source: 'owner' };
  }
  return null;
};

export const evaluateAccessPolicy = (input: {
  readonly actor: AccessActor;
  readonly action: AccessAction;
  readonly resource: AccessResource;
  readonly now: string;
  /**
   * The app's grant-only actions (ADR-0015 vocabulary injection). Defaults to
   * this app's `GRANT_ONLY_ACTIONS`; a different app injects its own so the same
   * policy core serves any vocabulary.
   */
  readonly grantOnlyActions?: ReadonlyArray<AccessAction>;
}): AccessDecision => {
  const { actor, action, resource, now } = input;
  const grantOnlyActions: ReadonlyArray<AccessAction> =
    input.grantOnlyActions ?? GRANT_ONLY_ACTIONS;

  if (actor.accountStatus !== 'active') return accessDenied('account-disabled');
  if (actor.session.status !== 'active') return accessDenied('session-revoked');
  if (new Date(actor.session.expiresAt).getTime() <= new Date(now).getTime()) {
    return accessDenied('session-expired');
  }
  // Soft block: authenticated and resolved, but no operation is permitted.
  if (actor.blocked) return accessDenied('blocked');

  const bypass = ownershipDecision(actor, resource, action, grantOnlyActions);
  if (bypass) return bypass;

  const permitted = actor.permissions.some((permission) =>
    accessPermissionAllows({
      permission,
      action,
      resource,
      actorAccountId: actor.membership.accountId,
    }),
  );
  if (permitted) return { allowed: true, source: 'permission' };

  const grant = actor.grants.find((candidate) =>
    accessGrantAllows({ grant: candidate, action, resource, now }),
  );
  if (grant) return { allowed: true, source: 'grant', grantId: grant.id };

  return accessDenied('not-permitted');
};
