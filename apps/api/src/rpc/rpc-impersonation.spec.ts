import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../testing/rpc-harness';

/**
 * Per-endpoint contracts for the support/customer procedures. The full
 * impersonation arc is the heart of it: support cannot read a customer until
 * a grant is open, and loses it the moment the grant ends.
 */
describe('customer.search', () => {
  it('200s for support and finds the seeded customer', async () => {
    const res = await callRpc(testRuntime().app, 'customer.search', {
      token: 'session-support',
      body: { query: 'casa' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: ReadonlyArray<{ readonly accountId: string }>;
    };
    expect(body.data).toEqual([
      {
        accountId: 'acct-customer',
        displayName: 'Casa Pampa',
        email: 'ops@casapampa.example',
      },
    ]);
  });

  it('403s a customer', async () => {
    const res = await callRpc(testRuntime().app, 'customer.search', {
      token: 'session-customer',
      body: { query: 'casa' },
    });
    expect(res.status).toBe(403);
  });
});

describe('customer.read', () => {
  it('lets a customer read their own account, but nobody else without a grant', async () => {
    const { app } = testRuntime();
    const body = { accountId: 'acct-customer' };

    const own = await callRpc(app, 'customer.read', {
      token: 'session-customer',
      body,
    });
    expect(own.status).toBe(200);

    for (const token of ['session-support', 'session-owner']) {
      const res = await callRpc(app, 'customer.read', { token, body });
      expect(res.status).toBe(403);
    }
  });
});

describe('the impersonation arc', () => {
  it('start → read works → snapshot shows the grant → end → read denied again', async () => {
    const { app } = testRuntime();
    const read = () =>
      callRpc(app, 'customer.read', {
        token: 'session-support',
        body: { accountId: 'acct-customer' },
      });

    expect((await read()).status).toBe(403);

    const started = await callRpc(app, 'impersonation.start', {
      token: 'session-support',
      body: { targetAccountId: 'acct-customer', reason: 'ticket #42' },
    });
    expect(started.status).toBe(200);
    const grant = (await started.json()) as {
      readonly data: { readonly id: string; readonly expiresAt: string };
    };
    expect(grant.data.id).toBe('grant-1');
    expect(grant.data.expiresAt).toBe('2026-06-09T12:30:00.000Z');

    expect((await read()).status).toBe(200);

    const snapshot = await callRpc(app, 'access.current', {
      token: 'session-support',
    });
    const access = (await snapshot.json()) as {
      readonly data: { readonly activeGrants: ReadonlyArray<unknown> };
    };
    expect(access.data.activeGrants).toHaveLength(1);

    const ended = await callRpc(app, 'impersonation.end', {
      token: 'session-support',
      body: { grantId: 'grant-1' },
    });
    expect(ended.status).toBe(200);

    expect((await read()).status).toBe(403);

    const audit = await callRpc(app, 'audit.list', { token: 'session-owner' });
    const events = (await audit.json()) as {
      readonly data: ReadonlyArray<{
        readonly event: { readonly type: string };
      }>;
    };
    expect(events.data.map((r) => r.event.type)).toEqual([
      'impersonation.started',
      'impersonation.ended',
    ]);
  });
});

describe('impersonation.start edges', () => {
  it('403s a customer and 404s a target outside the customer directory', async () => {
    const { app } = testRuntime();

    const denied = await callRpc(app, 'impersonation.start', {
      token: 'session-customer',
      body: { targetAccountId: 'acct-customer', reason: 'nope' },
    });
    expect(denied.status).toBe(403);

    const staffTarget = await callRpc(app, 'impersonation.start', {
      token: 'session-support',
      body: { targetAccountId: 'acct-owner', reason: 'should not work' },
    });
    expect(staffTarget.status).toBe(404);
    expect(await errorTag(staffTarget)).toBe('app/customer-not-found');
  });

  it('400s a duration beyond the domain maximum', async () => {
    const res = await callRpc(testRuntime().app, 'impersonation.start', {
      token: 'session-support',
      body: {
        targetAccountId: 'acct-customer',
        reason: 'ticket #42',
        durationMinutes: 90,
      },
    });
    expect(res.status).toBe(400);
    expect(await errorTag(res)).toBe('api/invalid-input');
  });
});

describe('impersonation.end edges', () => {
  it('404s an unknown grant', async () => {
    const res = await callRpc(testRuntime().app, 'impersonation.end', {
      token: 'session-support',
      body: { grantId: 'grant-nope' },
    });
    expect(res.status).toBe(404);
    expect(await errorTag(res)).toBe('app/impersonation-grant-not-found');
  });
});
