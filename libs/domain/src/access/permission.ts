import { type Result, err, ok } from '@acme/shared';
import { invalidAccessScope } from './errors';
import type { AccessDomainError } from './errors';
import { makeAccessAction } from './value-objects';
import type { AccessAction, AccountId } from './value-objects';

/**
 * Permissions are the single persistent source of truth for authorization.
 * There are no rigid roles — "owner", "support" and "customer" exist only as
 * administrative presets (see presets.ts) that expand to permission lists.
 *
 * A permission pairs an action with a scope:
 * - `own`  → only on resources belonging to the actor's own account.
 * - `any`  → on any account's resources.
 */
export type AccessScope = 'own' | 'any';

export type AccessPermission = {
  readonly action: AccessAction;
  readonly scope: AccessScope;
};

/**
 * The resource side of an authorization check. `accountId` is the owning
 * account, or `null` for system-level resources that belong to no single
 * account (e.g. the global audit trail) — those require `any` scope.
 */
export type AccessResource = {
  readonly accountId: AccountId | null;
};

/** Boundary validation: external input becomes a permission only through here. */
export const makeAccessPermission = (raw: {
  readonly action: string;
  readonly scope: string;
}): Result<AccessPermission, AccessDomainError> => {
  const action = makeAccessAction(raw.action);
  if (!action.ok) return err(action.error);
  if (raw.scope !== 'own' && raw.scope !== 'any') {
    return err(invalidAccessScope(`Unknown access scope "${raw.scope}".`));
  }
  return ok({ action: action.value, scope: raw.scope });
};

export const accessPermissionAllows = (input: {
  readonly permission: AccessPermission;
  readonly action: AccessAction;
  readonly resource: AccessResource;
  readonly actorAccountId: AccountId;
}): boolean => {
  if (input.permission.action !== input.action) return false;
  if (input.permission.scope === 'any') return true;
  return (
    input.resource.accountId !== null &&
    input.resource.accountId === input.actorAccountId
  );
};
