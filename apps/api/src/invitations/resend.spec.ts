import { describe, expect, it } from 'vitest';
import { createInMemoryNotificationSender } from '@acme/infrastructure';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Resending an invitation. Only the token's HASH is stored, so the original
 * plaintext is unrecoverable — a resend cannot re-send the SAME link, it must
 * mint a new one. These specs pin that: the email carries a working link, and
 * the previous link is dead.
 */
type Issued = {
  readonly data: { readonly invitationId: string; readonly token: string };
};

const world = (failWith?: string) => {
  const notifications = createInMemoryNotificationSender(
    failWith ? { failWith } : {},
  );
  return { notifications, ...testRuntime({ notifications }) };
};

const issue = async (app: ReturnType<typeof testRuntime>['app']) => {
  const res = await callRpc(app, 'members.invite', {
    token: 'session-owner',
    body: {
      accountId: 'acct-owner',
      email: 'resend@acme.test',
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

describe('invitations.resend', () => {
  it('emails a WORKING fresh link and kills the previous one', async () => {
    const { app, notifications } = world();
    const { invitationId, token: original } = await issue(app);

    const res = await callRpc(app, 'invitations.resend', {
      token: 'session-owner',
      body: { invitationId },
    });
    expect(res.status).toBe(200);

    // One email, to the invitee, carrying an activation link.
    expect(notifications.sent).toHaveLength(1);
    const message = notifications.sent[0];
    expect(message?.to).toBe('resend@acme.test');
    const link = /#token=([^\s]+)/.exec(message?.body ?? '');
    expect(link).not.toBeNull();

    // The ORIGINAL link is dead — that is what "rotates" means.
    const stale = await activate(app, original);
    expect(stale.status).toBe(400);
    expect(await errorTag(stale)).toBe('app/invitation-token-invalid');

    // And the one we just mailed actually works.
    const fresh = decodeURIComponent(link?.[1] ?? '');
    const activated = await activate(app, fresh);
    expect(activated.status).toBe(200);
  });

  it('surfaces a provider failure instead of reporting a phantom send', async () => {
    const { app } = world('smtp exploded');
    const { invitationId } = await issue(app);

    const res = await callRpc(app, 'invitations.resend', {
      token: 'session-owner',
      body: { invitationId },
    });
    expect(res.status).toBe(502);
    expect(await errorTag(res)).toBe('app/notification-failed');
  });

  it('404s an unknown invitation and 403s a customer', async () => {
    const { app, notifications } = world();
    const { invitationId } = await issue(app);

    const missing = await callRpc(app, 'invitations.resend', {
      token: 'session-owner',
      body: { invitationId: 'inv-ghost' },
    });
    expect(missing.status).toBe(404);

    const denied = await callRpc(app, 'invitations.resend', {
      token: 'session-customer',
      body: { invitationId },
    });
    expect(denied.status).toBe(403);
    expect(await errorTag(denied)).toBe('app/access-denied');
    expect(notifications.sent).toHaveLength(0);
  });
});
