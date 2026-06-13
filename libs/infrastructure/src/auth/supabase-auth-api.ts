import { type Result, err, ok } from '@acme/shared';
import type { AuthError, AuthSession } from '@acme/application';

/**
 * Minimal GoTrue REST plumbing for the Supabase auth adapter. Raw fetch on
 * purpose: the three endpoints we need (password grant, signup, refresh,
 * logout) don't justify shipping supabase-js to every client bundle.
 */
export type SupabaseAuthConfig = {
  readonly supabaseUrl: string;
  /** The public (anon/publishable) key — not a secret. */
  readonly anonKey: string;
  readonly storage: {
    readonly get: () => Promise<string | null>;
    readonly set: (value: string | null) => Promise<void>;
  };
  readonly fetchFn?: typeof fetch;
  readonly now?: () => number;
};

/** What we persist via platform.secureStorage (never localStorage). */
export type StoredSupabaseSession = {
  readonly session: AuthSession;
  readonly refreshToken: string;
};

type GoTrueSession = {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly expires_at?: number;
  readonly user?: {
    readonly id?: string;
    readonly email?: string | null;
    readonly user_metadata?: { readonly display_name?: string };
  };
};

const providerError = (message: string): AuthError => ({
  tag: 'auth/provider-error',
  message,
});

export const toStoredSupabaseSession = (
  payload: GoTrueSession,
  nowMs: number,
): StoredSupabaseSession | null => {
  if (!payload.access_token || !payload.refresh_token || !payload.user?.id) {
    return null;
  }
  const expiresAt =
    payload.expires_at !== undefined
      ? payload.expires_at * 1000
      : nowMs + (payload.expires_in ?? 3600) * 1000;
  return {
    session: {
      user: {
        id: payload.user.id,
        email: payload.user.email ?? null,
        displayName: payload.user.user_metadata?.display_name ?? null,
      },
      accessToken: payload.access_token,
      expiresAt,
    },
    refreshToken: payload.refresh_token,
  };
};

type GoTrueErrorPayload = {
  readonly error_description?: string;
  readonly msg?: string;
  readonly error?: string;
};

const errorMessageOf = (payload: GoTrueErrorPayload, status: number): string =>
  payload.error_description ??
  payload.msg ??
  payload.error ??
  `Auth request failed (${status}).`;

export const gotrueRequest = async (
  config: SupabaseAuthConfig,
  input: {
    readonly path: string;
    readonly method?: 'POST' | 'PUT';
    readonly body?: unknown;
    readonly bearer?: string;
  },
): Promise<Result<GoTrueSession, AuthError>> => {
  const fetchFn = config.fetchFn ?? fetch;
  try {
    const response = await fetchFn(
      `${config.supabaseUrl}/auth/v1/${input.path}`,
      {
        method: input.method ?? 'POST',
        headers: {
          apikey: config.anonKey,
          'content-type': 'application/json',
          ...(input.bearer ? { authorization: `Bearer ${input.bearer}` } : {}),
        },
        ...(input.body === undefined
          ? {}
          : { body: JSON.stringify(input.body) }),
      },
    );
    if (response.status === 204) return ok({});
    const payload = (await response.json()) as GoTrueSession &
      GoTrueErrorPayload;
    if (!response.ok) {
      return err(providerError(errorMessageOf(payload, response.status)));
    }
    return ok(payload);
  } catch (cause) {
    return err(providerError(`Auth request failed: ${String(cause)}`));
  }
};
