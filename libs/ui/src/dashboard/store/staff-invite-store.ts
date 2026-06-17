import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type InvitationsUseCases,
  inviteStaffToOwnAccount,
  loadInviteCapability,
} from '@acme/application';

/** Reactive store for the staff invite form. Dumb: delegates to the controller. */
export type StaffInviteStoreState = {
  readonly canInvite: boolean;
  readonly token: string | null;
  readonly error: string | null;
  readonly busy: boolean;
  readonly load: () => Promise<void>;
  readonly invite: (email: string) => Promise<void>;
};

export type StaffInviteStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly invitations: InvitationsUseCases;
};

export const createStaffInviteStore = (deps: StaffInviteStoreDeps) =>
  createStore<StaffInviteStoreState>((set) => ({
    canInvite: false,
    token: null,
    error: null,
    busy: false,
    load: async () => {
      const result = await loadInviteCapability(deps);
      if (result.ok) set({ canInvite: result.value.canInvite });
    },
    invite: async (email) => {
      set({ busy: true, error: null });
      const result = await inviteStaffToOwnAccount(deps, { email });
      set(
        result.ok
          ? { busy: false, token: result.value.token }
          : { busy: false, error: result.error.message },
      );
    },
  }));

export type StaffInviteStore = ReturnType<typeof createStaffInviteStore>;
