import { createStore } from 'zustand/vanilla';
import {
  type OrgRolesDeps,
  type OrgRolesViewModel,
  createOrgRole,
  deleteOrgRole,
  loadOrgRoles,
  resetOrgRole,
} from '@acme/application';

/**
 * Thin reactive store for the client's "manage your org's roles" feature. Every
 * action DELEGATES to a headless controller (`flows/client/roles`) and reloads;
 * no orchestration lives here, so an MCP server reuses the same functions.
 */
export type OrgRolesStoreState = {
  readonly vm: OrgRolesViewModel | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly load: () => Promise<void>;
  readonly createRole: (input: {
    readonly name: string;
    readonly action: string;
    readonly scope: string;
  }) => Promise<void>;
  readonly deleteRole: (roleId: string) => Promise<void>;
  readonly resetRole: (roleId: string) => Promise<void>;
};

export const createOrgRolesStore = (deps: OrgRolesDeps) =>
  createStore<OrgRolesStoreState>((set, get) => ({
    vm: null,
    error: null,
    notice: null,
    load: async () => {
      const result = await loadOrgRoles(deps);
      set(
        result.ok
          ? { vm: result.value, error: null }
          : { error: result.error.message },
      );
    },
    createRole: async (input) => {
      const result = await createOrgRole(deps, {
        name: input.name,
        permissions: [{ action: input.action, scope: input.scope }],
      });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: `Created role “${input.name}”.` });
      await get().load();
    },
    deleteRole: async (roleId) => {
      const result = await deleteOrgRole(deps, { roleId });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: 'Role deleted.' });
      await get().load();
    },
    resetRole: async (roleId) => {
      const result = await resetOrgRole(deps, { roleId });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: 'Role reset to its default.' });
      await get().load();
    },
  }));

export type OrgRolesStore = ReturnType<typeof createOrgRolesStore>;
