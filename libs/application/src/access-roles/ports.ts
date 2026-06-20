import type { AccessPermission, AccountId, Role, RoleId } from '@acme/domain';

/**
 * Persistence for dynamic roles (ADR-0011). A role is a named bundle of
 * permissions belonging to one account (`accountId`) or the platform
 * (`accountId: null`). The store is dumb CRUD + the two reads authorization
 * needs: `findManyById` (to expand a membership's roles into permissions) and
 * `countAssignments` (to refuse deleting a role still in use).
 */
export type RoleStore = {
  readonly create: (role: Role) => Promise<void>;
  /** Platform roles (accountId null) plus the given account's roles. */
  readonly list: (accountId: AccountId | null) => Promise<ReadonlyArray<Role>>;
  readonly findById: (roleId: RoleId) => Promise<Role | null>;
  /** Expansion: resolve a membership's `roleIds` to their roles. */
  readonly findManyById: (
    roleIds: ReadonlyArray<RoleId>,
  ) => Promise<ReadonlyArray<Role>>;
  /** Rotate a role's name/permissions; false if no such role. */
  readonly update: (
    roleId: RoleId,
    patch: {
      readonly name: string;
      readonly permissions: ReadonlyArray<AccessPermission>;
    },
  ) => Promise<boolean>;
  readonly remove: (roleId: RoleId) => Promise<void>;
  /** How many memberships reference this role (blocked-in-use delete guard). */
  readonly countAssignments: (roleId: RoleId) => Promise<number>;
};
