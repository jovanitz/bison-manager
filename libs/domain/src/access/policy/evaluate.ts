import type { AccessActor } from '../actor';
import { accessGrantAllows } from '../grant/grant';
import { accessPermissionAllows } from '../permission';
import type { AccessResource } from '../permission';
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

export const evaluateAccessPolicy = (input: {
  readonly actor: AccessActor;
  readonly action: AccessAction;
  readonly resource: AccessResource;
  readonly now: string;
}): AccessDecision => {
  const { actor, action, resource, now } = input;

  if (actor.accountStatus !== 'active') return accessDenied('account-disabled');
  if (actor.session.status !== 'active') return accessDenied('session-revoked');
  if (new Date(actor.session.expiresAt).getTime() <= new Date(now).getTime()) {
    return accessDenied('session-expired');
  }
  // Soft block: authenticated and resolved, but no operation is permitted.
  if (actor.blocked) return accessDenied('blocked');

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
