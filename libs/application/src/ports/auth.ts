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
/**
 * Identity only — deliberately no roles or permissions here. A session proves
 * *who* is calling; what they may do is resolved fresh from persisted state
 * via `getCurrentAccess` (see the access module), so revocation and permission
 * changes take effect immediately instead of riding inside a token.
 */
export type AuthUser = {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
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

export type AuthCredentials = {
  readonly email: string;
  readonly password: string;
};

export type AuthProvider = {
  readonly getSession: () => Promise<Result<AuthSession, AuthError>>;
  readonly signIn: (
    credentials: AuthCredentials,
  ) => Promise<Result<AuthSession, AuthError>>;
  /** Self-registration (customers); providers without it return an error. */
  readonly signUp: (
    credentials: AuthCredentials,
  ) => Promise<Result<AuthSession, AuthError>>;
  readonly signOut: () => Promise<void>;
  /**
   * Starts a password recovery (e.g. sends a reset email). Succeeds without
   * revealing whether the email exists — never an account-existence probe.
   */
  readonly requestPasswordReset: (
    email: string,
  ) => Promise<Result<void, AuthError>>;
  /** Sets a new password for the CURRENT session's identity. */
  readonly updatePassword: (
    newPassword: string,
  ) => Promise<Result<void, AuthError>>;
  /** Returns a fresh bearer token, refreshing transparently if needed. */
  readonly getAccessToken: () => Promise<Result<string, AuthError>>;
  readonly onChange: (
    listener: (session: AuthSession | null) => void,
  ) => () => void;
};
