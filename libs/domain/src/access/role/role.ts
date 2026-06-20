import { type Brand, type Result, err, ok } from '@acme/shared';
import { invalidRoleName } from '../errors';
import type { AccessDomainError } from '../errors';
import type { AccessPermission } from '../permission';
import type { AccountId, RoleId } from '../value-objects';

/**
 * A Role is a NAMED bundle of permissions — the assignment layer over the
 * atomic `{ action, scope }` permissions (ADR-0011). It only *expands* to
 * permissions; it never bypasses the policy core. A role belongs to one account
 * (`accountId`) or to the whole platform (`accountId: null`).
 *
 * The domain models the role's own rules (a valid name); coherence of its
 * permissions against an account kind is an application concern
 * (`guardGrantedPermissions`), so it is not enforced here.
 */
export type RoleName = Brand<string, 'RoleName'>;

export const ROLE_NAME_MAX_LENGTH = 60;

export const makeRoleName = (
  raw: string,
): Result<RoleName, AccessDomainError> => {
  const value = raw.trim();
  if (value.length === 0) {
    return err(invalidRoleName('A role name must not be empty.'));
  }
  if (value.length > ROLE_NAME_MAX_LENGTH) {
    return err(
      invalidRoleName(`A role name must be ${ROLE_NAME_MAX_LENGTH} chars max.`),
    );
  }
  return ok(value as RoleName);
};

export type Role = {
  readonly id: RoleId;
  readonly name: RoleName;
  /** The owning account, or `null` for a platform-wide role. */
  readonly accountId: AccountId | null;
  readonly permissions: ReadonlyArray<AccessPermission>;
  /**
   * Provenance (ADR-0012): the factory template this role derives from, or
   * `null` for a custom role. Template-derived roles are non-deletable and
   * resettable; custom roles are free-form.
   */
  readonly templateKey: string | null;
};

/** Assemble a valid Role from already-branded parts plus a raw name. */
export const createRole = (input: {
  readonly id: RoleId;
  readonly name: string;
  readonly accountId: AccountId | null;
  readonly permissions: ReadonlyArray<AccessPermission>;
  /** Defaults to `null` (a custom role); set when instantiating a template. */
  readonly templateKey?: string | null;
}): Result<Role, AccessDomainError> => {
  const name = makeRoleName(input.name);
  if (!name.ok) return err(name.error);
  return ok({
    id: input.id,
    name: name.value,
    accountId: input.accountId,
    permissions: input.permissions,
    templateKey: input.templateKey ?? null,
  });
};
