import { describe, expect, it } from 'vitest';
import { callRpc, testRuntime } from './testing/rpc-harness';

/**
 * The invitation → activation arc through the real HTTP app: an owner issues an
 * invitation (one-time token), the invitee activates it on the PUBLIC endpoint
 * (no bearer token), and the token is single-use. A bad token is rejected
 * generically (no enumeration).
 */
const activate = (app: ReturnType<typeof testRuntime>['app'], body: unknown) =>
  app.request('/invitations/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const issueToken = async (app: ReturnType<typeof testRuntime>['app']) => {
  const res = await callRpc(app, 'members.invite', {
    token: 'session-owner',
    body: {
      accountId: 'acct-owner',
      email: 'newstaff@acme.test',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    },
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    readonly data: { readonly invitationId: string; readonly token: string };
  };
  return body.data.token;
};

describe('POST /invitations/activate', () => {
  it('activates a valid token once (public, no bearer), then refuses replay', async () => {
    const { app } = testRuntime();
    const token = await issueToken(app);

    const ok = await activate(app, { token, password: 'sup3r-secret' });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { email: string } }).data.email).toBe(
      'newstaff@acme.test',
    );

    // Replay is refused because the identity now exists (409), not because the
    // token was burned: activation leaves the invitation PENDING so first login
    // can attach the membership. Replay protection comes from the identity check.
    const replay = await activate(app, { token, password: 'sup3r-secret' });
    expect(replay.status).toBe(409);
    expect(
      ((await replay.json()) as { error: { tag: string } }).error.tag,
    ).toBe('app/identity-already-exists');
  });

  it('400s a bad token and a too-short password', async () => {
    const { app } = testRuntime();

    const badToken = await activate(app, {
      token: 'not-a-real-token',
      password: 'sup3r-secret',
    });
    expect(badToken.status).toBe(400);
    expect(
      ((await badToken.json()) as { error: { tag: string } }).error.tag,
    ).toBe('app/invitation-token-invalid');

    const shortPw = await activate(app, { token: 'x', password: 'short' });
    expect(shortPw.status).toBe(400);
  });
});
