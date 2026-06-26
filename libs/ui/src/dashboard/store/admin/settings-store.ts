import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type SessionPoliciesDto,
  type SettingsGateway,
  type SettingsViewModel,
  loadSessionPolicy,
  updateSessionPolicy,
} from '@acme/application';

/** Reactive store for the session-policy editor (owner only). Dumb. */
export type SettingsStoreState = {
  readonly vm: SettingsViewModel | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly load: () => Promise<void>;
  readonly save: (policies: SessionPoliciesDto) => Promise<void>;
};

export type SettingsStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly settings: SettingsGateway;
};

export const createSettingsStore = (deps: SettingsStoreDeps) =>
  createStore<SettingsStoreState>((set, get) => ({
    vm: null,
    error: null,
    notice: null,
    load: async () => {
      const result = await loadSessionPolicy(deps);
      set(
        result.ok
          ? { vm: result.value, error: null }
          : { error: result.error.message },
      );
    },
    save: async (policies) => {
      const result = await updateSessionPolicy(deps, { policies });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: 'Session policy saved.' });
      await get().load();
    },
  }));

export type SettingsStore = ReturnType<typeof createSettingsStore>;
