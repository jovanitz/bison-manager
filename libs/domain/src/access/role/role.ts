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
  /**
   * Propagation state (ADR-0014, eager model). Only meaningful with a
   * `templateKey`: `true` while the instance tracks its staff template (a
   * staff edit propagates to it); flips to `false` when the org edits it
   * locally (a fork). A reset re-syncs it. Custom roles carry `true` inertly.
   */
  readonly templateSynced: boolean;
  /**
   * Roles-only model (ADR-0014, Phase 2): a **personal role** is owned by
   * exactly one membership and holds its one-off permissions (the replacement
   * for the removed per-membership direct list). It is account-scoped, never a
   * template, hidden from the org roles list, and removed with its membership.
   */
  readonly isPersonal: boolean;
};

/** Assemble a valid Role from already-branded parts plus a raw name. */
export const createRole = (input: {
  readonly id: RoleId;
  readonly name: string;
  readonly accountId: AccountId | null;
  readonly permissions: ReadonlyArray<AccessPermission>;
  /** Defaults to `null` (a custom role); set when instantiating a template. */
  readonly templateKey?: string | null;
  /** Tracks-its-template flag (ADR-0014); defaults to `true` (synced). */
  readonly templateSynced?: boolean;
  /** Personal role (ADR-0014, Phase 2); defaults to `false`. */
  readonly isPersonal?: boolean;
}): Result<Role, AccessDomainError> => {
  const name = makeRoleName(input.name);
  if (!name.ok) return err(name.error);
  return ok({
    id: input.id,
    name: name.value,
    accountId: input.accountId,
    permissions: input.permissions,
    templateKey: input.templateKey ?? null,
    templateSynced: input.templateSynced ?? true,
    isPersonal: input.isPersonal ?? false,
  });
};
