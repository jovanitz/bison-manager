import { type Result, err, ok } from '@acme/shared';
import { invalidAccessScope } from './errors';
import type { AccessDomainError } from './errors';
import { ACCESS_ACTIONS, makeAccessActionIn } from './value-objects';
import type { AccessAction, AccountId } from './value-objects';

/**
 * Permissions are the single persistent source of truth for authorization.
 * There are no rigid roles — "owner", "support" and "customer" exist only as
 * administrative presets (see presets.ts) that expand to permission lists.
 *
 * A permission pairs an action with a scope:
 * - `own`  → only on resources belonging to the actor's own account.
 * - `any`  → on any account's resources.
 *
 * Scope is an **extension point** (ADR-0014): the list below is the single
 * source, and `scopeAllows` is the single matcher. A future scope (e.g. a
 * group/resource selector) is added in exactly those two places — the
 * exhaustive `switch` makes the compiler demand the new case.
 */
export const ACCESS_SCOPES = ['own', 'any'] as const;

export type AccessScope = (typeof ACCESS_SCOPES)[number];

/**
 * A permission, generic over the app's action vocabulary (ADR-0015). Defaults
 * to this app's `AccessAction`; `AccessPermission` is the bison-manager alias
 * (same shape), so existing usages are unaffected.
 */
export type AccessPermissionOf<Action extends string = AccessAction> = {
  readonly action: Action;
  readonly scope: AccessScope;
};

export type AccessPermission = AccessPermissionOf<AccessAction>;

/**
 * The resource side of an authorization check. `accountId` is the owning
 * account, or `null` for system-level resources that belong to no single
 * account (e.g. the global audit trail) — those require `any` scope.
 */
export type AccessResource = {
  readonly accountId: AccountId | null;
};

/** Boundary validation: external input becomes a permission only through here. */
/**
 * Boundary validation against a given action catalog (ADR-0015: vocabulary
 * injection). Generic over the catalog so a different app parses and narrows to
 * ITS own permission type, reusing this one parser.
 */
export const makeAccessPermissionIn = <Action extends string>(
  raw: { readonly action: string; readonly scope: string },
  catalog: ReadonlyArray<Action>,
): Result<AccessPermissionOf<Action>, AccessDomainError> => {
  const action = makeAccessActionIn(raw.action, catalog);
  if (!action.ok) return err(action.error);
  if (!(ACCESS_SCOPES as readonly string[]).includes(raw.scope)) {
    return err(invalidAccessScope(`Unknown access scope "${raw.scope}".`));
  }
  return ok({ action: action.value, scope: raw.scope as AccessScope });
};

/** This app's boundary validator — validates against `ACCESS_ACTIONS`. */
export const makeAccessPermission = (raw: {
  readonly action: string;
  readonly scope: string;
}): Result<AccessPermission, AccessDomainError> =>
  makeAccessPermissionIn(raw, ACCESS_ACTIONS);

/**
 * The single seam where a scope decides whether it covers a resource. Adding a
 * scope = adding a `case` here (ADR-0014); the exhaustive switch makes the
 * compiler require it.
 */
const scopeAllows = (
  scope: AccessScope,
  resource: AccessResource,
  actorAccountId: AccountId,
): boolean => {
  switch (scope) {
    case 'any':
      return true;
    case 'own':
      return (
        resource.accountId !== null && resource.accountId === actorAccountId
      );
  }
};

export const accessPermissionAllows = (input: {
  readonly permission: AccessPermission;
  readonly action: AccessAction;
  readonly resource: AccessResource;
  readonly actorAccountId: AccountId;
}): boolean => {
  if (input.permission.action !== input.action) return false;
  return scopeAllows(
    input.permission.scope,
    input.resource,
    input.actorAccountId,
  );
};
