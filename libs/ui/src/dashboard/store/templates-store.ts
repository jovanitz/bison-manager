import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type RolesGateway,
  type TemplatesViewModel,
  applyTemplateToAll,
  loadDefaultTemplates,
  resetDefaultTemplate,
  updateDefaultTemplate,
} from '@acme/application';

/** Reactive store for the staff dashboard's default-role templates (ADR-0013). */
export type TemplatesStoreState = {
  readonly vm: TemplatesViewModel | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly load: () => Promise<void>;
  /** Edit a template's name + permissions, then reload. */
  readonly updateTemplate: (input: {
    readonly key: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }) => Promise<void>;
  /** Reset a template to its code definition (the recovery floor), then reload. */
  readonly resetTemplate: (key: string) => Promise<void>;
  /** Force every instance of a template back to it (forks included), then reload. */
  readonly applyToAll: (key: string) => Promise<void>;
};

export type TemplatesStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly roles: RolesGateway;
};

export const createTemplatesStore = (deps: TemplatesStoreDeps) =>
  createStore<TemplatesStoreState>((set, get) => ({
    vm: null,
    error: null,
    notice: null,
    load: async () => {
      const result = await loadDefaultTemplates(deps);
      set(
        result.ok
          ? { vm: result.value, error: null }
          : { error: result.error.message },
      );
    },
    updateTemplate: async (input) => {
      const result = await updateDefaultTemplate(deps, input);
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: `Saved template “${input.name}”.` });
      await get().load();
    },
    resetTemplate: async (key) => {
      const result = await resetDefaultTemplate(deps, { key });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: 'Template reset to its code default.' });
      await get().load();
    },
    applyToAll: async (key) => {
      const result = await applyTemplateToAll(deps, { key });
      if (!result.ok) {
        set({ notice: result.error.message });
        return;
      }
      set({ notice: `Applied to ${result.value.updated} role(s).` });
      await get().load();
    },
  }));

export type TemplatesStore = ReturnType<typeof createTemplatesStore>;
