import type { RoleStore } from '@acme/application';
import type { AccountId, Role, RoleId } from '@acme/domain';
import type { AccessStoreState } from '../in-memory-access-seed';

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
      (role) => role.accountId === null || role.accountId === accountId,
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
    });
    return true;
  },
  remove: async (roleId: RoleId) => {
    state.roles.delete(roleId);
  },
  countAssignments: async (roleId: RoleId) =>
    [...state.memberships.values()].filter((m) => m.roleIds.includes(roleId))
      .length,
});
