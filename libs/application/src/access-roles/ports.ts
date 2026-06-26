import type {
  AccessPermission,
  AccountId,
  Role,
  RoleId,
  RoleTemplate,
} from '@acme/domain';

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
  /** Rotate a role's name/permissions (and optionally its sync flag); false if
   * no such role. Omitting `templateSynced` leaves it unchanged. */
  readonly update: (
    roleId: RoleId,
    patch: {
      readonly name: string;
      readonly permissions: ReadonlyArray<AccessPermission>;
      readonly templateSynced?: boolean;
    },
  ) => Promise<boolean>;
  readonly remove: (roleId: RoleId) => Promise<void>;
  /** How many memberships reference this role (blocked-in-use delete guard). */
  readonly countAssignments: (roleId: RoleId) => Promise<number>;
  /**
   * Propagate a template edit to its live instances (ADR-0014, eager model):
   * set name + permissions on every role with this `templateKey`, re-stamping
   * `templateSynced = true`. With `includeForked: false` only instances still
   * synced are touched (a normal staff edit); `true` forces every instance,
   * synced or forked (the staff "apply to all"). Returns how many were updated.
   */
  readonly syncTemplate: (
    templateKey: string,
    patch: {
      readonly name: string;
      readonly permissions: ReadonlyArray<AccessPermission>;
    },
    options: { readonly includeForked: boolean },
  ) => Promise<number>;
};

/**
 * Persistence for the staff-editable default-role templates (ADR-0013/0014).
 * Templates are the curated defaults org instances reset to. The store holds
 * only staff *overrides*; the code catalogue (`ROLE_TEMPLATES`) is the rest and
 * the recovery floor, merged over the overrides in the use case — so the store
 * never needs seeding and the keys are always the code keys.
 */
export type RoleTemplateStore = {
  /** Only the templates a staff member has edited; code is the rest (merged in
   * the use case). Template keys are always the code keys — no custom templates. */
  readonly list: () => Promise<ReadonlyArray<RoleTemplate>>;
  readonly findByKey: (key: string) => Promise<RoleTemplate | null>;
  /** Insert or replace a template override (a staff edit, or reset-to-code). */
  readonly upsert: (template: RoleTemplate) => Promise<void>;
};
