import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type BlockUseCases,
  type DashboardViewModel,
  type DirectoryUseCases,
  loadDashboard,
  setSubjectBlocked,
} from '@acme/application';

/** Reactive store for the staff dashboard tables + org soft-block. Dumb. */
export type DashboardStoreState = {
  readonly vm: DashboardViewModel | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly load: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  /** Returns the per-row notice text (success label or error message). */
  readonly setOrgBlocked: (id: string, blocked: boolean) => Promise<string>;
};

export type DashboardStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly directory: DirectoryUseCases;
  readonly block: BlockUseCases;
};

export const createDashboardStore = (deps: DashboardStoreDeps) =>
  createStore<DashboardStoreState>((set) => ({
    vm: null,
    error: null,
    notice: null,
    signOut: () => deps.access.signOut(),
    load: async () => {
      const result = await loadDashboard(deps);
      set(
        result.ok
          ? { vm: result.value, error: null }
          : { error: result.error.message },
      );
    },
    setOrgBlocked: async (id, blocked) => {
      const result = await setSubjectBlocked(deps, {
        subject: 'org',
        id,
        blocked,
      });
      const done = blocked ? 'Blocked' : 'Unblocked';
      return result.ok ? done : result.error.message;
    },
  }));

export type DashboardStore = ReturnType<typeof createDashboardStore>;
