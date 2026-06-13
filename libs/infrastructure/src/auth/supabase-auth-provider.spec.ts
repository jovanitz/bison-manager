import { describe, expect, it } from 'vitest';
import type { AuthSession } from '@acme/application';
import { createSupabaseAuthProvider } from './supabase-auth-provider';

const NOW = 1_750_000_000_000;

const gotrueSession = (over: Record<string, unknown> = {}) => ({
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 3600,
  user: { id: 'user-1', email: 'a@example.com' },
  ...over,
});

const makeWorld = (input: {
  responses: Array<{ status: number; body: unknown }>;
  nowMs?: number;
}) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const queue = [...input.responses];
  let stored: string | null = null;
  const provider = createSupabaseAuthProvider({
    supabaseUrl: 'https://supabase.local',
    anonKey: 'anon-key',
    storage: {
      get: async () => stored,
      set: async (value) => {
        stored = value;
      },
    },
    fetchFn: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift() ?? { status: 500, body: { msg: 'empty' } };
      return new Response(JSON.stringify(next.body), { status: next.status });
    }) as typeof fetch,
    now: () => input.nowMs ?? NOW,
  });
  return { provider, calls, storedValue: () => stored };
};

describe('createSupabaseAuthProvider', () => {
  it('signs in against the password grant and persists the session', async () => {
    const world = makeWorld({
      responses: [{ status: 200, body: gotrueSession() }],
    });
    const r = await world.provider.signIn({
      email: 'a@example.com',
      password: 'secret',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.user.id).toBe('user-1');
    expect(r.value.expiresAt).toBe(NOW + 3_600_000);
    expect(world.calls[0]?.url).toBe(
      'https://supabase.local/auth/v1/token?grant_type=password',
    );
    expect(
      (world.calls[0]?.init.headers as Record<string, string>)['apikey'],
    ).toBe('anon-key');
    expect(world.storedValue()).toContain('refresh-1');
  });

  it('maps GoTrue errors to auth/provider-error', async () => {
    const world = makeWorld({
      responses: [
        {
          status: 400,
          body: { error_description: 'Invalid login credentials' },
        },
      ],
    });
    const r = await world.provider.signIn({
      email: 'a@example.com',
      password: 'wrong',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.tag).toBe('auth/provider-error');
      expect(r.error.message).toContain('Invalid login');
    }
  });

  it('refreshes transparently when the access token expired', async () => {
    const world = makeWorld({
      responses: [
        { status: 200, body: gotrueSession({ expires_in: -60 }) },
        {
          status: 200,
          body: gotrueSession({
            access_token: 'access-2',
            refresh_token: 'refresh-2',
          }),
        },
      ],
    });
    await world.provider.signIn({ email: 'a@example.com', password: 's' });
    const token = await world.provider.getAccessToken();
    expect(token.ok).toBe(true);
    if (token.ok) expect(token.value).toBe('access-2');
    expect(world.calls[1]?.url).toContain('grant_type=refresh_token');
    expect(world.storedValue()).toContain('refresh-2');
  });

  it('drops the session and reports expired when refresh fails', async () => {
    const world = makeWorld({
      responses: [
        { status: 200, body: gotrueSession({ expires_in: -60 }) },
        { status: 401, body: { msg: 'refresh token revoked' } },
      ],
    });
    await world.provider.signIn({ email: 'a@example.com', password: 's' });
    const token = await world.provider.getAccessToken();
    expect(token.ok).toBe(false);
    if (!token.ok) expect(token.error.tag).toBe('auth/expired');
    expect(world.storedValue()).toBeNull();
  });

  it('signs up (returns provider-error when confirmation withholds the session)', async () => {
    const world = makeWorld({
      responses: [{ status: 200, body: { user: { id: 'user-1' } } }],
    });
    const r = await world.provider.signUp({
      email: 'a@example.com',
      password: 's',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('confirmation');
  });

  it('requests a password recovery without needing a session', async () => {
    const world = makeWorld({ responses: [{ status: 200, body: {} }] });
    const r = await world.provider.requestPasswordReset('a@example.com');
    expect(r.ok).toBe(true);
    expect(world.calls[0]?.url).toBe('https://supabase.local/auth/v1/recover');
    expect(world.calls[0]?.init.body).toBe(
      JSON.stringify({ email: 'a@example.com' }),
    );
    expect(
      (world.calls[0]?.init.headers as Record<string, string>)['authorization'],
    ).toBeUndefined();
  });

  it('updates the password via PUT /user with the live bearer', async () => {
    const world = makeWorld({
      responses: [
        { status: 200, body: gotrueSession() },
        { status: 200, body: { user: { id: 'user-1' } } },
      ],
    });
    await world.provider.signIn({ email: 'a@example.com', password: 'old' });
    const r = await world.provider.updatePassword('new-secret');
    expect(r.ok).toBe(true);
    expect(world.calls[1]?.url).toBe('https://supabase.local/auth/v1/user');
    expect(world.calls[1]?.init.method).toBe('PUT');
    expect(world.calls[1]?.init.body).toBe(
      JSON.stringify({ password: 'new-secret' }),
    );
    expect(
      (world.calls[1]?.init.headers as Record<string, string>)['authorization'],
    ).toBe('Bearer access-1');
  });

  it('refuses to update the password without a session', async () => {
    const world = makeWorld({ responses: [] });
    const r = await world.provider.updatePassword('new-secret');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('auth/unauthenticated');
    expect(world.calls).toHaveLength(0);
  });

  it('signs out: best-effort GoTrue logout, clears storage, notifies', async () => {
    const world = makeWorld({
      responses: [
        { status: 200, body: gotrueSession() },
        { status: 204, body: null },
      ],
    });
    const seen: Array<AuthSession | null> = [];
    world.provider.onChange((s) => seen.push(s));
    await world.provider.signIn({ email: 'a@example.com', password: 's' });
    await world.provider.signOut();
    expect(world.calls[1]?.url).toBe('https://supabase.local/auth/v1/logout');
    expect(world.storedValue()).toBeNull();
    expect(seen[seen.length - 1]).toBeNull();
    expect((await world.provider.getSession()).ok).toBe(false);
  });
});
