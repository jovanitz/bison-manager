import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type RolesGateway,
  loadPlatformRoles,
} from '@acme/application';
import type { RoleDraft, RolesVM } from '../../roles/roles.types';
import { blankRole, draftFromRoleRow, toRolesVM } from './roles-vm';
import { runOverlay } from './overlay-runner';

/**
 * Reactive store for the staff Roles catalog (ADR-0011, ADR-0017 giro-owned).
 * `load` runs the headless `loadPlatformRoles` flow (gated by `permissions.update`)
 * and maps it to the VM; create/edit (live to holders) / delete / reset dispatch
 * to the roles gateway and reload. Overlay state is VM data; orchestration lives
 * here. Roles carry NO audited reason (unlike Plans) — none is collected.
 */
const LOADING: RolesVM = { roles: [], canManage: false, loading: true };

export type RolesStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly roles: RolesGateway;
};

export type RolesStoreState = {
  readonly vm: RolesVM;
  readonly load: () => Promise<void>;
  readonly openCreate: () => void;
  readonly openEdit: (roleId: string) => void;
  readonly cancelForm: () => void;
  readonly submitForm: (draft: RoleDraft) => Promise<void>;
  readonly openDelete: (roleId: string) => void;
  readonly confirmDelete: () => Promise<void>;
  readonly cancelDelete: () => void;
  readonly openReset: (roleId: string) => void;
  readonly confirmReset: () => Promise<void>;
  readonly cancelReset: () => void;
};

type IO = {
  readonly patch: (partial: Partial<RolesVM>) => void;
  readonly get: () => RolesStoreState;
  readonly reload: () => Promise<void>;
  readonly close: () => void;
};

/** The async mutations, split out to keep the store factory under the size cap. */
const roleMutations = (deps: RolesStoreDeps, io: IO) => ({
  submitForm: async (draft: RoleDraft): Promise<void> => {
    const form = io.get().vm.form;
    if (!form) return;
    const perms = draft.permissions;
    await runOverlay(
      (submitting, error) => io.patch({ form: { ...form, submitting, error } }),
      () =>
        form.mode === 'create'
          ? deps.roles.createRole({
              name: draft.name,
              accountId: null,
              permissions: perms,
            })
          : deps.roles.updateRole({
              roleId: form.roleId ?? '',
              name: draft.name,
              permissions: perms,
            }),
      async () => {
        io.close();
        await io.reload();
      },
    );
  },
  confirmDelete: async (): Promise<void> => {
    const p = io.get().vm.pendingDelete;
    if (!p) return;
    await runOverlay(
      (deleting, error) =>
        io.patch({ pendingDelete: { ...p, deleting, error } }),
      () => deps.roles.deleteRole(p.roleId),
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
      () => deps.roles.resetRole(p.roleId),
      async () => {
        io.close();
        await io.reload();
      },
    );
  },
});

export const createRolesStore = (deps: RolesStoreDeps) =>
  createStore<RolesStoreState>((set, get) => {
    const patch = (p: Partial<RolesVM>) => set({ vm: { ...get().vm, ...p } });
    const close = () =>
      patch({
        form: undefined,
        pendingDelete: undefined,
        pendingReset: undefined,
      });
    const reload = async () => {
      const r = await loadPlatformRoles({
        access: deps.access,
        roles: deps.roles,
      });
      set(
        r.ok
          ? { vm: toRolesVM(r.value) }
          : {
              vm: {
                roles: [],
                canManage: false,
                loading: false,
                error: r.error.message,
              },
            },
      );
    };
    const byId = (id: string) => get().vm.roles.find((x) => x.id === id);
    return {
      vm: LOADING,
      load: reload,
      openCreate: () =>
        patch({ form: { mode: 'create', roleId: null, draft: blankRole } }),
      openEdit: (id) => {
        const r = byId(id);
        if (r)
          patch({
            form: { mode: 'edit', roleId: id, draft: draftFromRoleRow(r) },
          });
      },
      cancelForm: close,
      openDelete: (id) => {
        const r = byId(id);
        if (r) patch({ pendingDelete: { roleId: id, name: r.name } });
      },
      cancelDelete: close,
      openReset: (id) => {
        const r = byId(id);
        if (r) patch({ pendingReset: { roleId: id, name: r.name } });
      },
      cancelReset: close,
      ...roleMutations(deps, { patch, get, reload, close }),
    };
  });

export type RolesStore = ReturnType<typeof createRolesStore>;
