import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../../../testing/rpc-harness';

/**
 * Pipeline contract for the ledger surface: the read is staff-authorized and
 * fail-open-to-empty; the corrections reach the use case (a missing payment
 * 404s through the shared store). Full void/refund accounting is unit-tested in
 * the application (reverse-payment.spec, list-ledger.spec).
 */
describe('billing.ledger', () => {
  it('staff read returns a ledger (empty until movements exist)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.ledger', {
      token: 'session-owner',
      body: { accountId: 'acct-customer' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: { readonly entries: unknown[]; readonly currency: string };
    };
    expect(Array.isArray(body.data.entries)).toBe(true);
    expect(body.data.currency).toBe('MXN');
  });

  it('403s a customer asking about a FOREIGN org (anti-enumeration)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.ledger', {
      token: 'session-customer',
      body: { accountId: 'acct-owner' },
    });
    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');
  });
});

describe('billing.void / billing.refund', () => {
  it('void reaches the use case — a missing payment 404s through the shared store', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.void', {
      token: 'session-owner',
      body: { paymentId: 'pay-nope', reason: 'recorded twice' },
    });
    expect(res.status).toBe(404);
    expect(await errorTag(res)).toBe('app/payment-not-found');
  });

  it('refund reaches the use case — missing payment 404s', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.refund', {
      token: 'session-owner',
      body: { paymentId: 'pay-nope', reason: 'customer returned' },
    });
    expect(res.status).toBe(404);
    expect(await errorTag(res)).toBe('app/payment-not-found');
  });

  it('rejects a missing reason (mandatory audit trail)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.void', {
      token: 'session-owner',
      body: { paymentId: 'pay-1' },
    });
    expect(res.status).toBe(400);
  });
});
