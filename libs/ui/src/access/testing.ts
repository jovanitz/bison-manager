import { ok } from '@acme/shared';
import type {
  AccessClientUseCases,
  AuthSession,
  CurrentAccessDto,
  ItemUseCases,
} from '@acme/application';

/** Test doubles for access screens (spec-only by convention). */
export const testAuthSession: AuthSession = {
  user: { id: 'user-1', email: 'a@example.com', displayName: null },
  accessToken: 'token-1',
  expiresAt: Number.MAX_SAFE_INTEGER,
};

export const testCurrentAccess: CurrentAccessDto = {
  membershipId: 'membership-1',
  userId: 'user-1',
  accountId: 'acct-1',
  accountStatus: 'active',
  session: {
    id: 'session-1',
    status: 'active',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
  permissions: [{ action: 'customer.read', scope: 'own' }],
  activeGrants: [],
};

export const mockAccessUseCases = (
  overrides: Partial<AccessClientUseCases>,
): AccessClientUseCases => ({
  signIn: async () => ok(testAuthSession),
  signUp: async () => ok(testAuthSession),
  signOut: async () => undefined,
  getSession: async () => ok(testAuthSession),
  currentAccess: async () => ok(testCurrentAccess),
  onAuthChange: () => () => undefined,
  ...overrides,
});

/** The login screen never touches items; an empty stub satisfies the DI. */
export const mockItems = {} as ItemUseCases;
