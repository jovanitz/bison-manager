import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type AdminGateState,
  resolveAdminGate,
} from '@acme/application';

/** Reactive store for the admin route gate. Dumb: delegates to the controller. */
export type AdminGateStoreState = {
  readonly gate: AdminGateState | 'loading';
  readonly resolve: () => Promise<void>;
  /** Subscribe to auth changes → re-resolve. Returns an unsubscribe. */
  readonly subscribe: () => () => void;
  readonly signOut: () => Promise<void>;
};

export const createAdminGateStore = (deps: {
  readonly access: AccessClientUseCases;
}) =>
  createStore<AdminGateStoreState>((set) => {
    const doResolve = async () => set({ gate: await resolveAdminGate(deps) });
    return {
      gate: 'loading',
      resolve: doResolve,
      subscribe: () => deps.access.onAuthChange(() => void doResolve()),
      signOut: () => deps.access.signOut(),
    };
  });

export type AdminGateStore = ReturnType<typeof createAdminGateStore>;
