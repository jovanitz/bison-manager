import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createInMemoryIdentityPurger,
  createUnconfiguredIdentityPurger,
} from './identity-purgers';
import { createSupabaseIdentityPurger } from './supabase-identity-purger';

describe('createInMemoryIdentityPurger', () => {
  it('records the erased identity so a spec can prove the call reached the provider', async () => {
    const purger = createInMemoryIdentityPurger();
    const result = await purger.deleteIdentity('user-1');
    expect(result.ok).toBe(true);
    expect(purger.deleted).toEqual(['user-1']);
  });

  it('fails (and records nothing) when configured to fail', async () => {
    const purger = createInMemoryIdentityPurger({ failWith: 'boom' });
    const result = await purger.deleteIdentity('user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('app/identity-purge-failed');
      expect(result.error.message).toBe('boom');
    }
    expect(purger.deleted).toEqual([]);
  });
});

describe('createUnconfiguredIdentityPurger', () => {
  it('fails CLOSED — an irreversible delete with no credentials must never report success', async () => {
    const result = await createUnconfiguredIdentityPurger().deleteIdentity('u');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/identity-purge-failed');
  });
});

const purger = createSupabaseIdentityPurger({
  supabaseUrl: 'http://supabase.test',
  secretKey: 'sb_secret_test',
});

const stubFetch = (impl: (url: string, init: RequestInit) => Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => impl(url, init)),
  );

afterEach(() => vi.unstubAllGlobals());

describe('createSupabaseIdentityPurger', () => {
  it('DELETEs the user via the GoTrue admin API with the secret key', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    stubFetch((url, init) => {
      captured = { url, init };
      return new Response('', { status: 200 });
    });

    const result = await purger.deleteIdentity('user 42');

    expect(result.ok).toBe(true);
    expect(captured!.url).toBe(
      'http://supabase.test/auth/v1/admin/users/user%2042',
    );
    expect(captured!.init.method).toBe('DELETE');
    expect(captured!.init.headers).toMatchObject({
      apikey: 'sb_secret_test',
      authorization: 'Bearer sb_secret_test',
    });
  });

  it('fails on a non-2xx (server error)', async () => {
    stubFetch(() => new Response('nope', { status: 500 }));
    const result = await purger.deleteIdentity('user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('app/identity-purge-failed');
      expect(result.error.message).toContain('500');
    }
  });

  it('treats a 404 as a FAILURE — erasing a user that is not there means our view is wrong', async () => {
    stubFetch(() => new Response('', { status: 404 }));
    const result = await purger.deleteIdentity('ghost');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/identity-purge-failed');
  });

  it('fails on a network error rather than reporting a delete that never happened', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const result = await purger.deleteIdentity('user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.tag).toBe('app/identity-purge-failed');
      expect(result.error.message).toContain('network down');
    }
  });
});
