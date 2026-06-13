import { type Result, err, ok } from '@acme/shared';
import type {
  ApiClient,
  AuthError,
  AuthProvider,
  AuthSession,
} from '@acme/application';

/**
 * Custom-JWT adapter for the `AuthProvider` port.
 *
 * Cognito, Auth0 and Clerk each get their own factory in this folder
 * (`createCognitoAuthProvider`, etc.) that wraps their SDK and returns the same
 * `AuthProvider` shape. The application and UI consume only the port, so the
 * provider is a one-line swap in the composition root. This one talks to a
 * generic token endpoint via the `ApiClient` port and persists the session
 * through an injected secure-storage setter/getter.
 */
export type JwtAuthConfig = {
  readonly api: ApiClient;
  readonly storage: {
    readonly get: () => Promise<string | null>;
    readonly set: (value: string | null) => Promise<void>;
  };
  readonly now?: () => number;
};

type JwtAuthState = {
  current: AuthSession | null;
  readonly listeners: Set<(s: AuthSession | null) => void>;
};

const restore = async (
  config: JwtAuthConfig,
  state: JwtAuthState,
): Promise<AuthSession | null> => {
  if (state.current) return state.current;
  const raw = await config.storage.get();
  if (!raw) return null;
  try {
    state.current = JSON.parse(raw) as AuthSession;
    return state.current;
  } catch {
    return null;
  }
};

/** The stored session, rejected when absent or past its expiry. */
const liveSession = async (
  config: JwtAuthConfig,
  state: JwtAuthState,
): Promise<Result<AuthSession, AuthError>> => {
  const now = config.now ?? (() => Date.now());
  const session = await restore(config, state);
  if (!session) {
    return err({ tag: 'auth/unauthenticated', message: 'No session.' });
  }
  if (session.expiresAt <= now()) {
    return err({ tag: 'auth/expired', message: 'Session expired.' });
  }
  return ok(session);
};

const requestJwtSession = async (
  config: JwtAuthConfig,
  input: {
    readonly operation: 'signIn' | 'signUp';
    readonly path: string;
    readonly credentials: { readonly email: string; readonly password: string };
  },
  notify: (s: AuthSession | null) => void,
): Promise<Result<AuthSession, AuthError>> => {
  const res = await config.api.request<AuthSession>({
    operation: input.operation,
    method: 'POST',
    path: input.path,
    body: input.credentials,
  });
  if (!res.ok) {
    return err({ tag: 'auth/provider-error', message: res.error.message });
  }
  await config.storage.set(JSON.stringify(res.value));
  notify(res.value);
  return ok(res.value);
};

/** Void mutations against the token endpoint (recover / password update). */
const requestJwtVoid = async (
  config: JwtAuthConfig,
  input: {
    readonly operation: string;
    readonly method: 'POST' | 'PUT';
    readonly path: string;
    readonly body: unknown;
  },
): Promise<Result<void, AuthError>> => {
  const res = await config.api.request<void>(input);
  if (!res.ok) {
    return err({ tag: 'auth/provider-error', message: res.error.message });
  }
  return ok(undefined);
};

export const createJwtAuthProvider = (config: JwtAuthConfig): AuthProvider => {
  const state: JwtAuthState = { current: null, listeners: new Set() };

  const notify = (s: AuthSession | null) => {
    state.current = s;
    for (const l of state.listeners) l(s);
  };

  return {
    getSession: () => liveSession(config, state),

    signIn: (credentials) =>
      requestJwtSession(
        config,
        { operation: 'signIn', path: 'auth/login', credentials },
        notify,
      ),

    signUp: (credentials) =>
      requestJwtSession(
        config,
        { operation: 'signUp', path: 'auth/signup', credentials },
        notify,
      ),

    signOut: async () => {
      await config.storage.set(null);
      notify(null);
    },

    requestPasswordReset: (email) =>
      requestJwtVoid(config, {
        operation: 'requestPasswordReset',
        method: 'POST',
        path: 'auth/recover',
        body: { email },
      }),

    updatePassword: async (newPassword) => {
      const session = await liveSession(config, state);
      if (!session.ok) return err(session.error);
      return requestJwtVoid(config, {
        operation: 'updatePassword',
        method: 'PUT',
        path: 'auth/password',
        body: { password: newPassword },
      });
    },

    getAccessToken: async (): Promise<Result<string, AuthError>> => {
      const session = await liveSession(config, state);
      return session.ok ? ok(session.value.accessToken) : err(session.error);
    },

    onChange: (listener) => {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
  };
};
