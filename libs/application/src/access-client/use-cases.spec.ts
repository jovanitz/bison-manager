import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import { accessGatewayError } from './errors';
import type { AuthProvider, AuthSession } from '../ports/auth';
import type { CurrentAccessGateway } from './ports';
import { makeAccessClientUseCases } from './use-cases';

const session: AuthSession = {
  user: { id: 'user-1', email: 'a@example.com', displayName: null },
  accessToken: 'token-1',
  expiresAt: Date.now() + 60_000,
};

const fakeAuth = (input?: { startSignedIn?: boolean }) => {
  let active: AuthSession | null = input?.startSignedIn ? session : null;
  let password = 'correct';
  const listeners = new Set<(s: AuthSession | null) => void>();
  const calls: string[] = [];
  const provider: AuthProvider = {
    getSession: async () =>
      active
        ? ok(active)
        : err({ tag: 'auth/unauthenticated', message: 'No session.' }),
    signIn: async (credentials) => {
      calls.push('signIn');
      if (credentials.password !== password) {
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
    requestPasswordReset: async () => {
      calls.push('requestPasswordReset');
      return ok(undefined);
    },
    updatePassword: async (newPassword) => {
      calls.push('updatePassword');
      password = newPassword;
      return ok(undefined);
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
  return { provider, calls, signedOut: () => active === null };
};

const fakeGateway = (input?: {
  revokeFails?: boolean;
  calls?: string[];
}): CurrentAccessGateway => ({
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
  revokeOwnSessions: async () => {
    input?.calls?.push('revokeOwnSessions');
    return input?.revokeFails
      ? err(accessGatewayError('API unreachable.'))
      : ok({ revoked: 3 });
  },
});

describe('makeAccessClientUseCases', () => {
  it('signs in, exposes the session, notifies listeners and signs out', async () => {
    const { provider } = fakeAuth();
    const seen: Array<AuthSession | null> = [];
    const uc = makeAccessClientUseCases({
      auth: provider,
      gateway: fakeGateway(),
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
      gateway: fakeGateway(),
    });
    const access = await uc.currentAccess();
    expect(access.ok).toBe(true);
    if (access.ok) {
      expect(access.value.permissions).toEqual([
        { action: 'customer.read', scope: 'own' },
      ]);
    }
  });

  it('delegates the recovery request to the provider', async () => {
    const auth = fakeAuth();
    const uc = makeAccessClientUseCases({
      auth: auth.provider,
      gateway: fakeGateway(),
    });
    expect((await uc.requestPasswordReset('a@example.com')).ok).toBe(true);
    expect(auth.calls).toEqual(['requestPasswordReset']);
  });
});

describe('changePassword', () => {
  it('updates, revokes every session, then signs in fresh — in that order', async () => {
    const auth = fakeAuth({ startSignedIn: true });
    const calls = auth.calls;
    const uc = makeAccessClientUseCases({
      auth: auth.provider,
      gateway: fakeGateway({ calls }),
    });
    const r = await uc.changePassword({ newPassword: 'rotated-secret' });
    expect(r.ok).toBe(true);
    expect(calls).toEqual(['updatePassword', 'revokeOwnSessions', 'signIn']);
    // the fresh sign-in only works because the password really rotated
    expect((await uc.getSession()).ok).toBe(true);
  });

  it('propagates a failed revocation and skips the re-sign-in', async () => {
    const auth = fakeAuth({ startSignedIn: true });
    const uc = makeAccessClientUseCases({
      auth: auth.provider,
      gateway: fakeGateway({ revokeFails: true, calls: auth.calls }),
    });
    const r = await uc.changePassword({ newPassword: 'rotated-secret' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-gateway-error');
    expect(auth.calls).toEqual(['updatePassword', 'revokeOwnSessions']);
  });

  it('requires a live session', async () => {
    const auth = fakeAuth();
    const uc = makeAccessClientUseCases({
      auth: auth.provider,
      gateway: fakeGateway(),
    });
    const r = await uc.changePassword({ newPassword: 'rotated-secret' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('auth/unauthenticated');
    expect(auth.calls).toEqual([]);
  });
});
