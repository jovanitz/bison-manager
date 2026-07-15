import type { RoleStore } from '@acme/application';
import type { AccountId, Role, RoleId } from '@acme/domain';
import type { AccessStoreState } from '../in-memory/access-seed';

/**
 * In-memory {@link RoleStore} over the shared {@link AccessStoreState} — the
 * reference adapter the Postgres one is contract-tested against. `list` returns
 * platform roles (accountId null) plus the account's own; `countAssignments`
 * scans memberships for the role id (the delete-blocked-in-use guard).
 */
export const createInMemoryRoleStore = (
  state: AccessStoreState,
): RoleStore => ({
  create: async (role: Role) => {
    state.roles.set(role.id, role);
  },
  list: async (accountId: AccountId | null) =>
    [...state.roles.values()].filter(
      (role) =>
        // personal roles are an internal per-membership slot, never a listable
        // org role (ADR-0014 Phase 2): excluded from management + assignment.
        !role.isPersonal &&
        (role.accountId === null || role.accountId === accountId),
    ),
  findById: async (roleId: RoleId) => state.roles.get(roleId) ?? null,
  findManyById: async (roleIds: ReadonlyArray<RoleId>) =>
    roleIds.flatMap((id) => {
      const role = state.roles.get(id);
      return role ? [role] : [];
    }),
  update: async (roleId, patch) => {
    const role = state.roles.get(roleId);
    if (!role) return false;
    state.roles.set(roleId, {
      ...role,
      name: patch.name as Role['name'],
      permissions: patch.permissions,
      templateSynced: patch.templateSynced ?? role.templateSynced,
    });
    return true;
  },
  remove: async (roleId: RoleId) => {
    state.roles.delete(roleId);
  },
  countAssignments: async (roleId: RoleId) =>
    [...state.memberships.values()].filter((m) => m.roleIds.includes(roleId))
      .length,
  syncTemplate: async (templateKey, patch, options) => {
    let updated = 0;
    for (const role of state.roles.values()) {
      if (role.templateKey !== templateKey) continue;
      if (!options.includeForked && !role.templateSynced) continue;
      state.roles.set(role.id, {
        ...role,
        name: patch.name as Role['name'],
        permissions: patch.permissions,
        templateSynced: true,
      });
      updated += 1;
    }
    return updated;
  },
});
