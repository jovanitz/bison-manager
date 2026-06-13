import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { createSupabaseTokenVerifier } from './token-verifier';

const SECRET = 'test-secret-at-least-32-characters-long!';
const NOW_S = Math.floor(Date.now() / 1000);

const claims = (over: Record<string, unknown> = {}) => ({
  sub: 'a8f5f167-0000-4000-8000-000000000001',
  session_id: 'b9e6f278-0000-4000-8000-000000000002',
  email: 'user@example.com',
  aud: 'authenticated',
  exp: NOW_S + 3600,
  ...over,
});

describe('createSupabaseTokenVerifier', () => {
  const verifier = createSupabaseTokenVerifier({ jwtSecret: SECRET });

  it('accepts a valid token and extracts the identity claims', async () => {
    const token = await sign(claims(), SECRET);
    const r = await verifier.verifyAccessToken(token);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.userId).toBe('a8f5f167-0000-4000-8000-000000000001');
    expect(r.value.sessionId).toBe('b9e6f278-0000-4000-8000-000000000002');
    expect(r.value.email).toBe('user@example.com');
  });

  it('rejects an expired token', async () => {
    const token = await sign(claims({ exp: NOW_S - 60 }), SECRET);
    const r = await verifier.verifyAccessToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/invalid-access-token');
  });

  it('rejects a token signed with another secret', async () => {
    const token = await sign(claims(), 'another-secret-32-characters-long!!');
    const r = await verifier.verifyAccessToken(token);
    expect(r.ok).toBe(false);
  });

  it('rejects garbage and tokens missing identity claims', async () => {
    expect((await verifier.verifyAccessToken('not-a-jwt')).ok).toBe(false);
    const noSession = await sign(claims({ session_id: undefined }), SECRET);
    expect((await verifier.verifyAccessToken(noSession)).ok).toBe(false);
  });

  it('rejects a token whose audience is not a user session', async () => {
    for (const aud of [undefined, 'anon', 'service_role']) {
      const token = await sign(claims({ aud }), SECRET);
      const r = await verifier.verifyAccessToken(token);
      expect(r.ok).toBe(false);
    }
    // an array audience that includes 'authenticated' is accepted
    const arrayAud = await sign(claims({ aud: ['authenticated'] }), SECRET);
    expect((await verifier.verifyAccessToken(arrayAud)).ok).toBe(true);
  });

  it('treats a missing email as null identity email', async () => {
    const token = await sign(claims({ email: undefined }), SECRET);
    const r = await verifier.verifyAccessToken(token);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBeNull();
  });
});
