import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Purging an orphan identity through the real HTTP app.
 *
 * The delete is irreversible and lands in the auth provider, so the server never
 * takes the caller's word for it: the interesting specs are the REFUSALS. A
 * stale dashboard could hand us the userId of someone who joined an org a second
 * ago, and erasing a real member's identity would be unrecoverable.
 */
const orphans = async (app: ReturnType<typeof testRuntime>['app']) => {
  const res = await callRpc(app, 'identities.orphaned', {
    token: 'session-owner',
    body: {},
  });
  return ((await res.json()) as { data: ReadonlyArray<{ userId: string }> })
    .data;
};

const purge = (
  app: ReturnType<typeof testRuntime>['app'],
  token: string,
  userId: string,
) => callRpc(app, 'identities.delete', { token, body: { userId } });

describe('identities.delete', () => {
  it('erases the orphan and drops it from the orphan list', async () => {
    const { app } = testRuntime();
    expect((await orphans(app)).map((o) => o.userId)).toContain('user-zombie');

    const res = await purge(app, 'session-owner', 'user-zombie');
    expect(res.status).toBe(200);

    expect((await orphans(app)).map((o) => o.userId)).not.toContain(
      'user-zombie',
    );
  });

  it('REFUSES an identity that holds a membership — the guard that matters', async () => {
    const { app } = testRuntime();
    // `user-customer` is a real member; it is not, and never was, an orphan.
    const res = await purge(app, 'session-owner', 'user-customer');
    expect(res.status).toBe(409);
    expect(await errorTag(res)).toBe('app/identity-not-orphan');

    // Still there, still a member.
    const still = await callRpc(app, 'access.current', {
      token: 'session-customer',
    });
    expect(still.status).toBe(200);
  });

  it('404-free on a second purge: the identity is simply no longer an orphan', async () => {
    const { app } = testRuntime();
    expect((await purge(app, 'session-owner', 'user-zombie')).status).toBe(200);

    const again = await purge(app, 'session-owner', 'user-zombie');
    expect(again.status).toBe(409);
    expect(await errorTag(again)).toBe('app/identity-not-orphan');
  });

  it('is owner-only: support is denied even though it is staff', async () => {
    const { app } = testRuntime();
    const res = await purge(app, 'session-support', 'user-zombie');
    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');

    // Untouched.
    expect((await orphans(app)).map((o) => o.userId)).toContain('user-zombie');
  });
});
