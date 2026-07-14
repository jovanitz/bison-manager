import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../../testing/rpc-harness';

type SummaryBody = {
  readonly data: {
    readonly planKey: string;
    readonly phase: string;
    readonly paidThroughAt: string | null;
    readonly heldForPayment: boolean;
  };
};

const summary = (app: ReturnType<typeof testRuntime>['app'], token: string) =>
  callRpc(app, 'billing.summary', {
    token,
    body: { accountId: 'acct-customer' },
  });

describe('billing.summary', () => {
  it('403s a customer asking about a FOREIGN org with the generic denial (anti-enumeration)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.summary', {
      token: 'session-customer',
      body: { accountId: 'acct-owner' },
    });
    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');
  });

  it('404s an org with no subscription for staff (fail closed, never unlimited)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.summary', {
      token: 'session-owner',
      body: { accountId: 'acct-ghost' },
    });
    expect(res.status).toBe(404);
    expect(await errorTag(res)).toBe('app/subscription-not-found');
  });
});

describe('staff levers', () => {
  it('markPaid flips the derived phase to active instantly — no stored status', async () => {
    const { app } = testRuntime();
    const before = (await (
      await summary(app, 'session-owner')
    ).json()) as SummaryBody;
    expect(before.data.phase).toBe('past_due');
    expect(before.data.heldForPayment).toBe(false); // unpriced plan: no hold

    const paid = await callRpc(app, 'billing.markPaid', {
      token: 'session-owner',
      body: {
        accountId: 'acct-customer',
        paidThrough: '2026-12-31',
        reason: 'wire transfer, invoice #123',
        amountNote: 'MXN 4990',
      },
    });
    expect(paid.status).toBe(200);

    const after = (await (
      await summary(app, 'session-owner')
    ).json()) as SummaryBody;
    expect(after.data.phase).toBe('active');
    expect(after.data.paidThroughAt).toBe('2026-12-31');
  });

  it('changePlan moves the org and the summary follows the live reference', async () => {
    const { app } = testRuntime();
    const moved = await callRpc(app, 'billing.changePlan', {
      token: 'session-owner',
      body: {
        accountId: 'acct-customer',
        planId: 'plan-pro',
        reason: 'negotiated upgrade',
      },
    });
    expect(moved.status).toBe(200);

    const after = (await (
      await summary(app, 'session-owner')
    ).json()) as SummaryBody;
    expect(after.data.planKey).toBe('pro');
  });

  it('400s a reasonless lever (app/reason-required)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.extendTrial', {
      token: 'session-owner',
      body: {
        accountId: 'acct-customer',
        trialEndsAt: '2026-09-01',
        reason: ' ',
      },
    });
    expect(res.status).toBe(400);
    expect(await errorTag(res)).toBe('app/reason-required');
  });

  it('403s a customer touching any lever with the generic denial', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'billing.markPaid', {
      token: 'session-customer',
      body: {
        accountId: 'acct-customer',
        paidThrough: '2026-12-31',
        reason: 'self-service attempt',
      },
    });
    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');
  });
});

type CoverageBody = {
  readonly data: {
    readonly phase: string;
    readonly balanceMinor: number;
  } | null;
};

describe('billing.coverage', () => {
  const coverage = (
    app: ReturnType<typeof testRuntime>['app'],
    token: string,
    accountId: string,
  ) => callRpc(app, 'billing.coverage', { token, body: { accountId } });

  it('returns derived coverage for staff reading a customer', async () => {
    const { app } = testRuntime();
    const res = await coverage(app, 'session-owner', 'acct-customer');
    expect(res.status).toBe(200);
    const body = (await res.json()) as CoverageBody;
    expect(body.data).not.toBeNull();
    expect(typeof body.data?.phase).toBe('string');
    expect(typeof body.data?.balanceMinor).toBe('number');
  });

  it('404s an org with no subscription (fail closed, like the summary)', async () => {
    const { app } = testRuntime();
    const res = await coverage(app, 'session-owner', 'acct-ghost');
    expect(res.status).toBe(404);
    expect(await errorTag(res)).toBe('app/subscription-not-found');
  });

  it('403s a customer asking about a foreign org', async () => {
    const { app } = testRuntime();
    const res = await coverage(app, 'session-customer', 'acct-owner');
    expect(res.status).toBe(403);
    expect(await errorTag(res)).toBe('app/access-denied');
  });
});
