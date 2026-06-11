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

export const createJwtAuthProvider = (config: JwtAuthConfig): AuthProvider => {
  const now = config.now ?? (() => Date.now());
  const listeners = new Set<(s: AuthSession | null) => void>();
  let current: AuthSession | null = null;

  const notify = (s: AuthSession | null) => {
    current = s;
    for (const l of listeners) l(s);
  };

  const restore = async (): Promise<AuthSession | null> => {
    if (current) return current;
    const raw = await config.storage.get();
    if (!raw) return null;
    try {
      current = JSON.parse(raw) as AuthSession;
      return current;
    } catch {
      return null;
    }
  };

  return {
    getSession: async (): Promise<Result<AuthSession, AuthError>> => {
      const session = await restore();
      if (!session) {
        return err({ tag: 'auth/unauthenticated', message: 'No session.' });
      }
      if (session.expiresAt <= now()) {
        return err({ tag: 'auth/expired', message: 'Session expired.' });
      }
      return ok(session);
    },

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

    getAccessToken: async (): Promise<Result<string, AuthError>> => {
      const session = await restore();
      if (!session) {
        return err({ tag: 'auth/unauthenticated', message: 'No session.' });
      }
      if (session.expiresAt <= now()) {
        return err({ tag: 'auth/expired', message: 'Session expired.' });
      }
      return ok(session.accessToken);
    },

    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
