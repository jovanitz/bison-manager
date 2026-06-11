import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import { accessDenied } from '../access/errors';
import type { AuthProvider, AuthSession } from '../ports/auth';
import { makeAccessClientUseCases } from './use-cases';

const session: AuthSession = {
  user: { id: 'user-1', email: 'a@example.com', displayName: null },
  accessToken: 'token-1',
  expiresAt: Date.now() + 60_000,
};

const fakeAuth = (): { provider: AuthProvider; signedOut: () => boolean } => {
  let active: AuthSession | null = null;
  const listeners = new Set<(s: AuthSession | null) => void>();
  const provider: AuthProvider = {
    getSession: async () =>
      active
        ? ok(active)
        : err({ tag: 'auth/unauthenticated', message: 'No session.' }),
    signIn: async (credentials) => {
      if (credentials.password !== 'correct') {
        return err({ tag: 'auth/provider-error', message: 'Bad credentials.' });
      }
      active = session;
      for (const l of listeners) l(active);
      return ok(session);
    },
    signUp: async () => {
      active = session;
      return ok(session);
    },
    signOut: async () => {
      active = null;
      for (const l of listeners) l(null);
    },
    getAccessToken: async () =>
      active
        ? ok(active.accessToken)
        : err({ tag: 'auth/unauthenticated', message: 'No session.' }),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { provider, signedOut: () => active === null };
};

describe('makeAccessClientUseCases', () => {
  it('signs in, exposes the session, notifies listeners and signs out', async () => {
    const { provider } = fakeAuth();
    const seen: Array<AuthSession | null> = [];
    const uc = makeAccessClientUseCases({
      auth: provider,
      gateway: { fetchCurrentAccess: async () => err(accessDenied('no')) },
    });
    uc.onAuthChange((s) => seen.push(s));

    const bad = await uc.signIn({ email: 'a@example.com', password: 'nope' });
    expect(bad.ok).toBe(false);

    const good = await uc.signIn({
      email: 'a@example.com',
      password: 'correct',
    });
    expect(good.ok).toBe(true);
    expect((await uc.getSession()).ok).toBe(true);

    await uc.signOut();
    expect((await uc.getSession()).ok).toBe(false);
    expect(seen).toEqual([session, null]);
  });

  it('exposes the current access snapshot for UI gating', async () => {
    const { provider } = fakeAuth();
    const uc = makeAccessClientUseCases({
      auth: provider,
      gateway: {
        fetchCurrentAccess: async () =>
          ok({
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
          }),
      },
    });
    const access = await uc.currentAccess();
    expect(access.ok).toBe(true);
    if (access.ok) {
      expect(access.value.permissions).toEqual([
        { action: 'customer.read', scope: 'own' },
      ]);
    }
  });
});
