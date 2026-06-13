import { ok } from '@acme/shared';
import type { AuthProvider, AuthSession } from '@acme/application';

/**
 * A fully-authenticated fake `AuthProvider` for tests. It lets you simulate
 * "signed-in" without any real identity provider, and is the kind of swappable
 * adapter the ports-and-adapters design makes possible.
 */
export const createFakeAuthProvider = (
  overrides: Partial<AuthSession> = {},
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

  return {
    getSession: async () => ok(session),
    signIn: async () => ok(session),
    signUp: async () => ok(session),
    signOut: async () => undefined,
    requestPasswordReset: async () => ok(undefined),
    updatePassword: async () => ok(undefined),
    getAccessToken: async () => ok(session.accessToken),
    onChange: () => () => undefined,
  };
};
