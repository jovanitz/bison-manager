import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseAdminProvisioner } from './supabase-admin-provisioner';

const provisioner = createSupabaseAdminProvisioner({
  supabaseUrl: 'http://supabase.test',
  secretKey: 'sb_secret_test',
});

const stubFetch = (impl: (url: string, init: RequestInit) => Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => impl(url, init)),
  );

afterEach(() => vi.unstubAllGlobals());

describe('createSupabaseAdminProvisioner', () => {
  it('creates a confirmed identity via the admin API and returns the user id', async () => {
    let captured: { url: string; body: unknown } | null = null;
    stubFetch((url, init) => {
      captured = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 });
    });

    const result = await provisioner.createIdentity({
      email: 'a@acme.test',
      password: 'sup3r-secret',
    });

    expect(result.ok && result.value.userId).toBe('user-123');
    expect(captured!.url).toBe('http://supabase.test/auth/v1/admin/users');
    expect(captured!.body).toMatchObject({
      email: 'a@acme.test',
      email_confirm: true,
    });
  });

  it('maps 422 (already exists) to identity-already-exists', async () => {
    stubFetch(() => new Response('{}', { status: 422 }));
    const result = await provisioner.createIdentity({
      email: 'taken@acme.test',
      password: 'sup3r-secret',
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.tag).toBe('app/identity-already-exists');
  });

  it('maps any other non-2xx to identity-provision-failed', async () => {
    stubFetch(() => new Response('boom', { status: 500 }));
    const result = await provisioner.createIdentity({
      email: 'a@acme.test',
      password: 'sup3r-secret',
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.tag).toBe('app/identity-provision-failed');
  });

  it('maps a network failure to identity-provision-failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const result = await provisioner.createIdentity({
      email: 'a@acme.test',
      password: 'sup3r-secret',
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.tag).toBe('app/identity-provision-failed');
  });
});
