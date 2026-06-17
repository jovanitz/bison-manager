import { createStore } from 'zustand/vanilla';
import {
  type ClientGateState,
  type HomeDeps,
  type HomeViewModel,
  createOrg,
  loadHome,
  resolveClientGate,
  switchOrg,
} from '@acme/application';

/**
 * Reactive store for the client session shell: the gate state and the home
 * ViewModel + the self-service org commands. Dumb — every action delegates to
 * a headless controller and stores the result. No decisions live here.
 */
export type SessionStoreState = {
  readonly gate: ClientGateState | 'loading';
  readonly home: HomeViewModel | null;
  readonly error: string | null;
  readonly createError: string | null;
  readonly resolveGate: () => Promise<void>;
  /** Subscribe to auth changes → re-resolve the gate. Returns an unsubscribe. */
  readonly subscribe: () => () => void;
  readonly signOut: () => Promise<void>;
  readonly loadHome: () => Promise<void>;
  readonly switchTo: (membershipId: string) => Promise<void>;
  readonly create: (name: string) => Promise<void>;
};

export const createSessionStore = (deps: HomeDeps) =>
  createStore<SessionStoreState>((set) => {
    const doResolve = async () => set({ gate: await resolveClientGate(deps) });
    const refreshHome = async () => {
      const result = await loadHome(deps);
      set(
        result.ok
          ? { home: result.value, error: null }
          : { error: result.error.message },
      );
    };
    return {
      gate: 'loading',
      home: null,
      error: null,
      createError: null,
      resolveGate: doResolve,
      subscribe: () => deps.access.onAuthChange(() => void doResolve()),
      signOut: () => deps.access.signOut(),
      loadHome: refreshHome,
      switchTo: async (membershipId) => {
        const result = await switchOrg(deps, { membershipId });
        if (result.ok) await refreshHome();
      },
      create: async (name) => {
        set({ createError: null });
        const result = await createOrg(deps, { name });
        if (!result.ok) return set({ createError: result.error.message });
        await doResolve();
      },
    };
  });

export type SessionStore = ReturnType<typeof createSessionStore>;
