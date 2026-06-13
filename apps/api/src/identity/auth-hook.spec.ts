import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createApiRuntime } from '../composition-root';
import { seedWorld } from '../seed';
import { verifyStandardWebhook } from './auth-hook';

const SECRET =
  'v1,whsec_' + Buffer.from('local-hook-secret-0123').toString('base64');

const sign = (id: string, timestamp: string, body: string): string =>
  'v1,' +
  createHmac('sha256', Buffer.from('local-hook-secret-0123'))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');

const hookRuntime = () =>
  createApiRuntime({
    seed: seedWorld({
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      sessionCreatedAt: new Date().toISOString(),
    }),
    authHookSecret: SECRET,
  });

const postHook = (
  app: ReturnType<typeof hookRuntime>['app'],
  body: string,
  headers: Record<string, string>,
) =>
  app.request('/hooks/password-verification', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });

describe('verifyStandardWebhook', () => {
  it('accepts a correctly signed payload and rejects tampering', () => {
    const body = '{"valid":false}';
    const ok = verifyStandardWebhook({
      secret: SECRET,
      id: 'msg_1',
      timestamp: '1700000000',
      signatureHeader: sign('msg_1', '1700000000', body),
      body,
    });
    expect(ok).toBe(true);
    const tampered = verifyStandardWebhook({
      secret: SECRET,
      id: 'msg_1',
      timestamp: '1700000000',
      signatureHeader: sign('msg_1', '1700000000', body),
      body: '{"valid":true}',
    });
    expect(tampered).toBe(false);
  });
});

describe('POST /hooks/password-verification', () => {
  it('records login.failed for signed failed attempts', async () => {
    const { app } = hookRuntime();
    const body = JSON.stringify({ user_id: 'user-x', valid: false });
    const res = await postHook(app, body, {
      'webhook-id': 'msg_1',
      'webhook-timestamp': '1700000000',
      'webhook-signature': sign('msg_1', '1700000000', body),
    });
    expect(res.status).toBe(200);

    const audit = await app.request('/rpc/audit.list', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer session-owner',
      },
      body: '{}',
    });
    const events = (await audit.json()) as {
      data: ReadonlyArray<{ event: { type: string } }>;
    };
    expect(events.data.map((r) => r.event.type)).toContain('login.failed');
  });

  it('rejects a bad signature and ignores successful attempts', async () => {
    const { app } = hookRuntime();
    const body = JSON.stringify({ user_id: 'user-x', valid: false });
    const bad = await postHook(app, body, {
      'webhook-id': 'msg_1',
      'webhook-timestamp': '1700000000',
      'webhook-signature': 'v1,not-the-signature',
    });
    expect(bad.status).toBe(401);

    const okBody = JSON.stringify({ user_id: 'user-x', valid: true });
    const ok = await postHook(app, okBody, {
      'webhook-id': 'msg_2',
      'webhook-timestamp': '1700000001',
      'webhook-signature': sign('msg_2', '1700000001', okBody),
    });
    expect(ok.status).toBe(200);

    const audit = await app.request('/rpc/audit.list', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer session-owner',
      },
      body: '{}',
    });
    const events = (await audit.json()) as {
      data: ReadonlyArray<{ event: { type: string } }>;
    };
    expect(events.data.map((r) => r.event.type)).not.toContain('login.failed');
  });
});
