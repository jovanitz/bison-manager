import type { Result } from '@acme/shared';

/**
 * Authentication port — provider agnostic.
 *
 * Business logic must never know whether tokens come from Cognito, Auth0,
 * Clerk, or a bespoke JWT service. It only knows this shape: "I can ask for the
 * current session and a bearer token." Each provider gets an adapter in the
 * infrastructure layer that satisfies this type; swapping providers is a
 * composition-root change, not an application change.
 */
export type AuthUser = {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly roles: ReadonlyArray<string>;
};

export type AuthSession = {
  readonly user: AuthUser;
  readonly accessToken: string;
  readonly expiresAt: number;
};

export type AuthError = {
  readonly tag: 'auth/unauthenticated' | 'auth/expired' | 'auth/provider-error';
  readonly message: string;
};

export type AuthProvider = {
  readonly getSession: () => Promise<Result<AuthSession, AuthError>>;
  readonly signIn: (credentials: {
    email: string;
    password: string;
  }) => Promise<Result<AuthSession, AuthError>>;
  readonly signOut: () => Promise<void>;
  /** Returns a fresh bearer token, refreshing transparently if needed. */
  readonly getAccessToken: () => Promise<Result<string, AuthError>>;
  readonly onChange: (listener: (session: AuthSession | null) => void) => () => void;
};
