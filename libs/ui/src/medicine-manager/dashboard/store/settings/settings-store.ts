import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type SettingsGateway,
  loadSessionPolicy,
} from '@acme/application';
import type {
  SessionPolicyForm,
  SettingsVM,
} from '../../settings/settings.view';
import { EMPTY_POLICY, formToPolicies, policiesToForm } from './settings-vm';

/**
 * Reactive store for the session-policy editor (ADR-0010, ADR-0017 giro-owned).
 * `load` runs the headless `loadSessionPolicy` flow (gated on `settings.update`):
 * without the capability it returns hidden → `canManage: false` (read-only form).
 * `save` pushes the whole policy and reloads, surfacing a confirmation notice.
 */
const LOADING: SettingsVM = {
  policy: EMPTY_POLICY,
  canManage: false,
  loading: true,
};

export type SettingsStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly settings: SettingsGateway;
};

export type SettingsStoreState = {
  readonly vm: SettingsVM;
  readonly load: () => Promise<void>;
  readonly save: (policy: SessionPolicyForm) => Promise<void>;
};

export const createSettingsStore = (deps: SettingsStoreDeps) =>
  createStore<SettingsStoreState>((set, get) => {
    const patch = (p: Partial<SettingsVM>) =>
      set({ vm: { ...get().vm, ...p } });
    const reload = async () => {
      const r = await loadSessionPolicy({
        access: deps.access,
        settings: deps.settings,
      });
      if (!r.ok) {
        set({
          vm: {
            policy: EMPTY_POLICY,
            canManage: false,
            loading: false,
            error: r.error.message,
          },
        });
        return;
      }
      set({
        vm: r.value.hidden
          ? { policy: EMPTY_POLICY, canManage: false, loading: false }
          : {
              policy: policiesToForm(r.value.policies),
              canManage: true,
              loading: false,
            },
      });
    };
    return {
      vm: LOADING,
      load: reload,
      save: async (policy) => {
        patch({ saving: true, error: undefined, notice: undefined });
        const r = await deps.settings.update(formToPolicies(policy));
        if (!r.ok) {
          patch({ saving: false, error: r.error.message });
          return;
        }
        await reload();
        patch({ notice: 'Session policy saved.' });
      },
    };
  });

export type SettingsStore = ReturnType<typeof createSettingsStore>;
