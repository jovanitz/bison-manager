import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Revoking an invitation through the real HTTP app. The interesting property is
 * not that the row disappears from the list — it is that the LINK DIES: a token
 * already sitting in someone's inbox must stop activating the moment staff
 * withdraw the invitation, or "revoke" would be theatre.
 */
type Issued = {
  readonly data: { readonly invitationId: string; readonly token: string };
};

const issue = async (app: ReturnType<typeof testRuntime>['app']) => {
  const res = await callRpc(app, 'members.invite', {
    token: 'session-owner',
    body: {
      accountId: 'acct-owner',
      email: 'revoked@acme.test',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    },
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as Issued).data;
};

const activate = (app: ReturnType<typeof testRuntime>['app'], token: string) =>
  app.request('/invitations/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password: 'sup3r-secret' }),
  });

const pending = async (app: ReturnType<typeof testRuntime>['app']) => {
  const res = await callRpc(app, 'invitations.pending', {
    token: 'session-owner',
    body: {},
  });
  return ((await res.json()) as { data: ReadonlyArray<{ email: string }> })
    .data;
};

describe('invitations.revoke', () => {
  it('drops the invitation from the pending list AND kills its link', async () => {
    const { app } = testRuntime();
    const { invitationId, token } = await issue(app);
    expect(
      (await pending(app)).some((i) => i.email === 'revoked@acme.test'),
    ).toBe(true);

    const revoked = await callRpc(app, 'invitations.revoke', {
      token: 'session-owner',
      body: { invitationId },
    });
    expect(revoked.status).toBe(200);

    expect(
      (await pending(app)).some((i) => i.email === 'revoked@acme.test'),
    ).toBe(false);
    // The whole point: the one-time link no longer activates.
    const replay = await activate(app, token);
    expect(replay.status).toBe(400);
    expect(await errorTag(replay)).toBe('app/invitation-token-invalid');
  });

  it('404s an unknown / already-revoked invitation (idempotent from the caller)', async () => {
    const { app } = testRuntime();
    const { invitationId } = await issue(app);
    const first = await callRpc(app, 'invitations.revoke', {
      token: 'session-owner',
      body: { invitationId },
    });
    expect(first.status).toBe(200);

    const second = await callRpc(app, 'invitations.revoke', {
      token: 'session-owner',
      body: { invitationId },
    });
    expect(second.status).toBe(404);
    expect(await errorTag(second)).toBe('app/invitation-not-found');
  });

  it('403s a customer with the generic denial, leaving the invitation pending', async () => {
    const { app } = testRuntime();
    const { invitationId } = await issue(app);

    const denied = await callRpc(app, 'invitations.revoke', {
      token: 'session-customer',
      body: { invitationId },
    });
    expect(denied.status).toBe(403);
    expect(await errorTag(denied)).toBe('app/access-denied');
    expect(
      (await pending(app)).some((i) => i.email === 'revoked@acme.test'),
    ).toBe(true);
  });
});
