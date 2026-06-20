import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type RolesGateway,
  type RolesViewModel,
  createPlatformRole,
  deletePlatformRole,
  loadPlatformRoles,
  resetPlatformRole,
} from '@acme/application';

/** Reactive store for the dashboard's dynamic-role management (ADR-0011). Dumb. */
export type RolesStoreState = {
  readonly vm: RolesViewModel | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly load: () => Promise<void>;
  /** Create a platform role from a name + one permission, then reload. */
  readonly createRole: (input: {
    readonly name: string;
    readonly action: string;
    readonly scope: string;
  }) => Promise<void>;
  readonly deleteRole: (roleId: string) => Promise<void>;
  /** Reset a default role to its factory template (ADR-0012), then reload. */
  readonly resetRole: (roleId: string) => Promise<void>;
};

export type RolesStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly roles: RolesGateway;
};

export const createRolesStore = (deps: RolesStoreDeps) =>
  createStore<RolesStoreState>((set, get) => ({
    vm: null,
    error: null,
    notice: null,
    load: async () => {
      const result = await loadPlatformRoles(deps);
      set(
        result.ok
          ? { vm: result.value, error: null }
          : { error: result.error.message },
      );
    },
    createRole: async (input) => {
      const result = await createPlatformRole(deps, {
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
      const result = await deletePlatformRole(deps, { roleId });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: 'Role deleted.' });
      await get().load();
    },
    resetRole: async (roleId) => {
      const result = await resetPlatformRole(deps, { roleId });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: 'Role reset to its default.' });
      await get().load();
    },
  }));

export type RolesStore = ReturnType<typeof createRolesStore>;
