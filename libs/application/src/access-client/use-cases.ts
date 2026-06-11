import type { Result, TaggedError } from '@acme/shared';
import type { CurrentAccessDto } from '../access/dto';
import type {
  AuthCredentials,
  AuthError,
  AuthProvider,
  AuthSession,
} from '../ports/auth';
import type { CurrentAccessGateway } from './ports';

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
});
