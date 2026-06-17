import { createStore } from 'zustand/vanilla';
import {
  type OrgAdminDeps,
  type OrgAdminViewModel,
  grantMemberPermission,
  inviteToOrg,
  loadOrgAdmin,
  removeMember,
  setMemberBlocked,
} from '@acme/application';

/**
 * The thin, reactive store for the org-admin feature. It holds the ViewModel +
 * loading/error and exposes actions that DELEGATE to the headless controller.
 * No flow logic lives here: every action calls a controller function, stores
 * the result, and reloads. The controller — not the store — owns orchestration,
 * so an MCP server reuses the exact same code with no store at all.
 */
export type OrgAdminStoreState = {
  readonly vm: OrgAdminViewModel | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly notice: string | null;
  readonly inviteToken: string | null;
  readonly load: () => Promise<void>;
  readonly grant: (input: {
    readonly membershipId: string;
    readonly action: string;
  }) => Promise<void>;
  readonly invite: (email: string) => Promise<void>;
  readonly setBlocked: (
    membershipId: string,
    blocked: boolean,
  ) => Promise<void>;
  readonly remove: (membershipId: string) => Promise<void>;
};

const accountIdOf = (vm: OrgAdminViewModel | null): string | null =>
  vm && !vm.hidden ? vm.accountId : null;

export const createOrgAdminStore = (deps: OrgAdminDeps) =>
  createStore<OrgAdminStoreState>((set, get) => {
    const reload = async () => {
      const result = await loadOrgAdmin(deps);
      set(
        result.ok
          ? { loading: false, error: null, vm: result.value }
          : { loading: false, error: result.error.message },
      );
    };
    const after = async (result: {
      readonly ok: boolean;
      readonly error?: { readonly message: string };
    }) => {
      if (!result.ok)
        return set({ notice: result.error?.message ?? 'Failed.' });
      await reload();
    };
    return {
      vm: null,
      loading: true,
      error: null,
      notice: null,
      inviteToken: null,
      load: async () => {
        set({ loading: true, error: null });
        await reload();
      },
      grant: async ({ membershipId, action }) => {
        set({ notice: null });
        const accountId = accountIdOf(get().vm);
        if (!accountId) return;
        await after(
          await grantMemberPermission(deps, {
            accountId,
            membershipId,
            action,
          }),
        );
      },
      invite: async (email) => {
        set({ notice: null });
        const accountId = accountIdOf(get().vm);
        if (!accountId) return;
        const result = await inviteToOrg(deps, { accountId, email });
        if (!result.ok) return set({ notice: result.error.message });
        set({ inviteToken: result.value.token });
        await reload();
      },
      setBlocked: async (membershipId, blocked) => {
        set({ notice: null });
        await after(await setMemberBlocked(deps, { membershipId, blocked }));
      },
      remove: async (membershipId) => {
        set({ notice: null });
        await after(await removeMember(deps, { membershipId }));
      },
    };
  });

export type OrgAdminStore = ReturnType<typeof createOrgAdminStore>;
