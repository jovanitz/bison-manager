import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type BlockUseCases,
  type MembersUseCases,
  type RolesGateway,
  type StaffMembersViewModel,
  assignMemberRoles,
  grantStaffPermission,
  loadStaffMembers,
  setSubjectBlocked,
} from '@acme/application';

/** Reactive store for the permissions editor + per-identity soft-block. Dumb. */
export type StaffMembersStoreState = {
  readonly vm: StaffMembersViewModel | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly load: () => Promise<void>;
  readonly grant: (input: {
    readonly membershipId: string;
    readonly action: string;
    readonly scope: string;
  }) => Promise<void>;
  /** Returns the per-row notice text (success label or error message). */
  readonly setIdentityBlocked: (
    userId: string,
    blocked: boolean,
  ) => Promise<string>;
  /** Replace a member's whole role assignment (ADR-0011), then reload. */
  readonly assignRoles: (
    membershipId: string,
    roleIds: ReadonlyArray<string>,
  ) => Promise<void>;
};

export type StaffMembersStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly members: MembersUseCases;
  readonly block: BlockUseCases;
  readonly roles: RolesGateway;
};

const accountIdOf = (vm: StaffMembersViewModel | null): string | null =>
  vm && !vm.hidden ? vm.accountId : null;

export const createStaffMembersStore = (deps: StaffMembersStoreDeps) =>
  createStore<StaffMembersStoreState>((set, get) => {
    const reload = async () => {
      const result = await loadStaffMembers(deps);
      set(
        result.ok
          ? { vm: result.value, error: null }
          : { error: result.error.message },
      );
    };
    return {
      vm: null,
      error: null,
      notice: null,
      load: reload,
      grant: async ({ membershipId, action, scope }) => {
        set({ notice: null });
        const accountId = accountIdOf(get().vm);
        if (!accountId) return;
        const result = await grantStaffPermission(deps, {
          accountId,
          membershipId,
          action,
          scope,
        });
        if (!result.ok) return set({ notice: result.error.message });
        await reload();
      },
      setIdentityBlocked: async (userId, blocked) => {
        const result = await setSubjectBlocked(deps, {
          subject: 'identity',
          id: userId,
          blocked,
        });
        const done = blocked ? 'Blocked' : 'Unblocked';
        return result.ok ? done : result.error.message;
      },
      assignRoles: async (membershipId, roleIds) => {
        set({ notice: null });
        const result = await assignMemberRoles(deps, { membershipId, roleIds });
        if (!result.ok) return set({ notice: result.error.message });
        await reload();
      },
    };
  });

export type StaffMembersStore = ReturnType<typeof createStaffMembersStore>;
