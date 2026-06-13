import { type Result, type TaggedError, err } from '@acme/shared';
import type { CurrentAccessDto } from '../access/dto';
import type {
  AuthCredentials,
  AuthError,
  AuthProvider,
  AuthSession,
} from '../ports/auth';
import type { CurrentAccessGateway } from './ports';

export type ChangePasswordError =
  | AuthError
  | TaggedError<'app/access-gateway-error' | 'app/access-denied'>;

/**
 * Password change as a security event: set the new password, then kill every
 * session of the membership (the credential may be rotated BECAUSE it leaked),
 * then sign in again so only the device that changed it stays in.
 */
const makeChangePassword =
  (deps: AccessClientDeps) =>
  async (input: {
    readonly newPassword: string;
  }): Promise<Result<AuthSession, ChangePasswordError>> => {
    const session = await deps.auth.getSession();
    if (!session.ok) return err(session.error);
    const email = session.value.user.email;
    if (email === null) {
      return err({
        tag: 'auth/provider-error',
        message: 'Cannot change the password of an identity without email.',
      });
    }
    const updated = await deps.auth.updatePassword(input.newPassword);
    if (!updated.ok) return err(updated.error);
    const revoked = await deps.gateway.revokeOwnSessions();
    if (!revoked.ok) return err(revoked.error);
    return deps.auth.signIn({ email, password: input.newPassword });
  };

/**
 * The use-case bundle a CLIENT app (SPA/native) hands to its UI: identity
 * flows via the provider-agnostic `AuthProvider` port plus the read-only
 * access snapshot for permission gating. Thin on purpose — every real
 * authorization decision happens server-side; the UI only hides what would
 * be denied anyway.
 */
export type AccessClientDeps = {
  readonly auth: AuthProvider;
  readonly gateway: CurrentAccessGateway;
};

export type AccessClientUseCases = {
  readonly signIn: (
    credentials: AuthCredentials,
  ) => Promise<Result<AuthSession, AuthError>>;
  readonly signUp: (
    credentials: AuthCredentials,
  ) => Promise<Result<AuthSession, AuthError>>;
  readonly signOut: () => Promise<void>;
  readonly getSession: () => Promise<Result<AuthSession, AuthError>>;
  readonly currentAccess: () => Promise<
    Result<
      CurrentAccessDto,
      TaggedError<'app/access-gateway-error' | 'app/access-denied'>
    >
  >;
  readonly onAuthChange: (
    listener: (session: AuthSession | null) => void,
  ) => () => void;
  /** Sends the provider's recovery email; never reveals account existence. */
  readonly requestPasswordReset: (
    email: string,
  ) => Promise<Result<void, AuthError>>;
  readonly changePassword: (input: {
    readonly newPassword: string;
  }) => Promise<Result<AuthSession, ChangePasswordError>>;
};

export const makeAccessClientUseCases = (
  deps: AccessClientDeps,
): AccessClientUseCases => ({
  signIn: (credentials) => deps.auth.signIn(credentials),
  signUp: (credentials) => deps.auth.signUp(credentials),
  signOut: () => deps.auth.signOut(),
  getSession: () => deps.auth.getSession(),
  currentAccess: () => deps.gateway.fetchCurrentAccess(),
  onAuthChange: (listener) => deps.auth.onChange(listener),
  requestPasswordReset: (email) => deps.auth.requestPasswordReset(email),
  changePassword: makeChangePassword(deps),
});
