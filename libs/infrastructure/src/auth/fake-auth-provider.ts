import { err, ok } from '@acme/shared';
import type { AuthProvider, AuthSession } from '@acme/application';

/** Persist the demo signed-in flag so it survives a page refresh. */
export type FakeAuthStorage = {
  readonly get: () => Promise<string | null>;
  readonly set: (value: string | null) => Promise<void>;
};

/**
 * A fake `AuthProvider` for tests + dev. By default it is fully authenticated,
 * letting you simulate "signed-in" without any real identity provider — the
 * kind of swappable adapter the ports-and-adapters design makes possible.
 *
 * With `startSignedOut: true` it becomes stateful: it reports no session until
 * `signIn` is called (which flips it and notifies `onChange`). That lets a dev
 * build render the real login screen and click straight through it. Pass
 * `storage` to persist that flag across refreshes — the same way the real
 * provider keeps its session — so a reload doesn't bounce back to the login.
 */
export const createFakeAuthProvider = (
  overrides: Partial<AuthSession> = {},
  options: {
    readonly startSignedOut?: boolean;
    readonly storage?: FakeAuthStorage;
  } = {},
): AuthProvider => {
  const session: AuthSession = {
    user: {
      id: 'user-fake',
      email: 'dev@example.com',
      displayName: 'Dev User',
    },
    accessToken: 'fake-token',
    expiresAt: Number.MAX_SAFE_INTEGER,
    ...overrides,
  };

  const { storage } = options;
  // In-memory fallback (tests + the auto-authenticated mode); `storage`, when
  // given, is the source of truth so the flag survives a reload.
  let memSignedIn = !options.startSignedOut;
  const isSignedIn = async (): Promise<boolean> =>
    storage ? (await storage.get()) === 'signed-in' : memSignedIn;
  const listeners = new Set<(s: AuthSession | null) => void>();
  const setSignedIn = async (value: boolean): Promise<void> => {
    if (storage) await storage.set(value ? 'signed-in' : null);
    else memSignedIn = value;
    for (const listener of listeners) listener(value ? session : null);
  };
  const noSession = err({
    tag: 'auth/unauthenticated' as const,
    message: 'No session.',
  });

  return {
    getSession: async () => ((await isSignedIn()) ? ok(session) : noSession),
    signIn: async () => {
      await setSignedIn(true);
      return ok(session);
    },
    signUp: async () => {
      await setSignedIn(true);
      return ok(session);
    },
    signOut: async () => {
      await setSignedIn(false);
    },
    requestPasswordReset: async () => ok(undefined),
    updatePassword: async () => ok(undefined),
    getAccessToken: async () =>
      (await isSignedIn()) ? ok(session.accessToken) : noSession,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
