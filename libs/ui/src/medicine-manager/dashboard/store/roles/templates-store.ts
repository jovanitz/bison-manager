import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type RolesGateway,
  loadDefaultTemplates,
} from '@acme/application';
import type { TemplateDraft, TemplatesVM } from '../../roles/roles.types';
import { draftFromTemplateRow, toTemplatesVM } from './roles-vm';
import { runOverlay } from './overlay-runner';

/**
 * Reactive store for the default-role Templates (ADR-0013/0014). `load` runs the
 * headless `loadDefaultTemplates` flow (gated by `permissions.update`). Edit
 * (name + permissions) and reset only reseed NEW orgs; "apply to all" force-
 * overwrites every live instance and surfaces its `{updated}` count via `notice`.
 * No audited reason (roles/templates take none).
 */
const LOADING: TemplatesVM = { templates: [], canManage: false, loading: true };

export type TemplatesStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly roles: RolesGateway;
};

export type TemplatesStoreState = {
  readonly vm: TemplatesVM;
  readonly load: () => Promise<void>;
  readonly openEdit: (key: string) => void;
  readonly cancelForm: () => void;
  readonly submitForm: (draft: TemplateDraft) => Promise<void>;
  readonly openReset: (key: string) => void;
  readonly confirmReset: () => Promise<void>;
  readonly cancelReset: () => void;
  readonly openApply: (key: string) => void;
  readonly confirmApply: () => Promise<void>;
  readonly cancelApply: () => void;
};

type IO = {
  readonly patch: (partial: Partial<TemplatesVM>) => void;
  readonly get: () => TemplatesStoreState;
  readonly reload: () => Promise<void>;
  readonly close: () => void;
};

/** The async mutations, split out to keep the store factory under the size cap. */
const templateMutations = (deps: TemplatesStoreDeps, io: IO) => ({
  submitForm: async (draft: TemplateDraft): Promise<void> => {
    const form = io.get().vm.form;
    if (!form) return;
    await runOverlay(
      (submitting, error) => io.patch({ form: { ...form, submitting, error } }),
      () =>
        deps.roles.updateTemplate({
          key: form.key,
          name: draft.name,
          permissions: draft.permissions,
        }),
      async () => {
        io.close();
        await io.reload();
      },
    );
  },
  confirmReset: async (): Promise<void> => {
    const p = io.get().vm.pendingReset;
    if (!p) return;
    await runOverlay(
      (resetting, error) =>
        io.patch({ pendingReset: { ...p, resetting, error } }),
      () => deps.roles.resetTemplate(p.key),
      async () => {
        io.close();
        await io.reload();
      },
    );
  },
  // Inline (not runOverlay) so the {updated} blast-count lands in the notice.
  confirmApply: async (): Promise<void> => {
    const p = io.get().vm.pendingApply;
    if (!p) return;
    io.patch({ pendingApply: { ...p, applying: true, error: undefined } });
    const result = await deps.roles.applyTemplateToAll(p.key);
    if (!result.ok) {
      io.patch({
        pendingApply: { ...p, applying: false, error: result.error.message },
      });
      return;
    }
    io.close();
    // Reload first (it replaces the whole VM), THEN set the notice so the
    // blast-count survives instead of being wiped by the fresh catalog.
    await io.reload();
    io.patch({
      notice: `“${p.name}” applied to ${result.value.updated} live roles.`,
    });
  },
});

export const createTemplatesStore = (deps: TemplatesStoreDeps) =>
  createStore<TemplatesStoreState>((set, get) => {
    const patch = (p: Partial<TemplatesVM>) =>
      set({ vm: { ...get().vm, ...p } });
    const close = () =>
      patch({
        form: undefined,
        pendingReset: undefined,
        pendingApply: undefined,
      });
    const reload = async () => {
      const r = await loadDefaultTemplates({
        access: deps.access,
        roles: deps.roles,
      });
      set(
        r.ok
          ? { vm: toTemplatesVM(r.value) }
          : {
              vm: {
                templates: [],
                canManage: false,
                loading: false,
                error: r.error.message,
              },
            },
      );
    };
    const byKey = (key: string) =>
      get().vm.templates.find((t) => t.key === key);
    return {
      vm: LOADING,
      load: reload,
      openEdit: (key) => {
        const t = byKey(key);
        if (t)
          patch({
            form: { key, scope: t.scope, draft: draftFromTemplateRow(t) },
          });
      },
      cancelForm: close,
      openReset: (key) => {
        const t = byKey(key);
        if (t) patch({ pendingReset: { key, name: t.name } });
      },
      cancelReset: close,
      openApply: (key) => {
        const t = byKey(key);
        if (t) patch({ pendingApply: { key, name: t.name } });
      },
      cancelApply: close,
      ...templateMutations(deps, { patch, get, reload, close }),
    };
  });

export type TemplatesStore = ReturnType<typeof createTemplatesStore>;
