import { type Result, err, ok } from '@acme/shared';
import type { AuthError, AuthProvider, AuthSession } from '@acme/application';
import { gotrueRequest, toStoredSupabaseSession } from './supabase-auth-api';
import type {
  StoredSupabaseSession,
  SupabaseAuthConfig,
} from './supabase-auth-api';

/**
 * Supabase (GoTrue) adapter for the `AuthProvider` port: email+password
 * sign-in/sign-up, transparent refresh, logout that revokes the GoTrue
 * session. The token it yields proves identity only — authorization always
 * comes from the API's `access.current` (see the access-client use cases).
 */
type SupabaseAuthState = {
  current: StoredSupabaseSession | null;
  readonly listeners: Set<(s: AuthSession | null) => void>;
};

const nowOf = (config: SupabaseAuthConfig): number =>
  (config.now ?? (() => Date.now()))();

const persist = async (
  config: SupabaseAuthConfig,
  state: SupabaseAuthState,
  stored: StoredSupabaseSession | null,
): Promise<void> => {
  await config.storage.set(stored ? JSON.stringify(stored) : null);
  state.current = stored;
  for (const listener of state.listeners) listener(stored?.session ?? null);
};

const restore = async (
  config: SupabaseAuthConfig,
  state: SupabaseAuthState,
): Promise<StoredSupabaseSession | null> => {
  if (state.current) return state.current;
  const raw = await config.storage.get();
  if (!raw) return null;
  try {
    state.current = JSON.parse(raw) as StoredSupabaseSession;
    return state.current;
  } catch {
    return null;
  }
};

const startSession = async (
  config: SupabaseAuthConfig,
  state: SupabaseAuthState,
  path: string,
  credentials: { readonly email: string; readonly password: string },
): Promise<Result<AuthSession, AuthError>> => {
  const response = await gotrueRequest(config, { path, body: credentials });
  if (!response.ok) return err(response.error);
  const stored = toStoredSupabaseSession(response.value, nowOf(config));
  if (!stored) {
    return err({
      tag: 'auth/provider-error',
      message:
        'No session in the auth response (is email confirmation enabled?).',
    });
  }
  await persist(config, state, stored);
  return ok(stored.session);
};

/** Returns a live session, refreshing through GoTrue when expired. */
const ensureFresh = async (
  config: SupabaseAuthConfig,
  state: SupabaseAuthState,
): Promise<Result<StoredSupabaseSession, AuthError>> => {
  const stored = await restore(config, state);
  if (!stored) {
    return err({ tag: 'auth/unauthenticated', message: 'No session.' });
  }
  if (stored.session.expiresAt > nowOf(config)) return ok(stored);

  const refreshed = await gotrueRequest(config, {
    path: 'token?grant_type=refresh_token',
    body: { refresh_token: stored.refreshToken },
  });
  const next = refreshed.ok
    ? toStoredSupabaseSession(refreshed.value, nowOf(config))
    : null;
  if (!next) {
    await persist(config, state, null);
    return err({ tag: 'auth/expired', message: 'Session expired.' });
  }
  await persist(config, state, next);
  return ok(next);
};

export const createSupabaseAuthProvider = (
  config: SupabaseAuthConfig,
): AuthProvider => {
  const state: SupabaseAuthState = { current: null, listeners: new Set() };

  return {
    getSession: async () => {
      const fresh = await ensureFresh(config, state);
      return fresh.ok ? ok(fresh.value.session) : err(fresh.error);
    },

    signIn: (credentials) =>
      startSession(config, state, 'token?grant_type=password', credentials),

    signUp: (credentials) => startSession(config, state, 'signup', credentials),

    signOut: async () => {
      const stored = await restore(config, state);
      if (stored) {
        // Best-effort server-side revocation; local sign-out always wins.
        await gotrueRequest(config, {
          path: 'logout',
          bearer: stored.session.accessToken,
        });
      }
      await persist(config, state, null);
    },

    getAccessToken: async () => {
      const fresh = await ensureFresh(config, state);
      return fresh.ok ? ok(fresh.value.session.accessToken) : err(fresh.error);
    },

    onChange: (listener) => {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
  };
};
