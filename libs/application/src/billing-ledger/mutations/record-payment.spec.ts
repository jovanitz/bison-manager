import { describe, expect, it } from 'vitest';
import { subscription } from '../../billing-subscriptions/testing';
import {
  ORG,
  makeLedgerWorld,
  openCharge,
  outsider,
  proPlan,
  staff,
} from '../testing';

const PAY_AT = '2026-06-09T00:00:00.000Z'; // = TEST_ACCESS_NOW date
const postTrial = subscription({ trialEndsAt: '2026-03-01T00:00:00.000Z' });
const period = (from: string, to: string) => ({
  dueDate: from,
  period: { from, to },
});
const pay = (over?: { readonly actor?: typeof staff }) => ({
  actor: over?.actor ?? staff,
  accountId: ORG,
  amountMinor: 5684,
  payAt: PAY_AT,
  reason: 'bank transfer',
});

describe('recordPayment', () => {
  it('settles an open charge paid within grace and records the payment', async () => {
    const { useCases, charges, payments } = makeLedgerWorld({
      sub: postTrial,
      charges: [openCharge()], // due 2026-06-05, still in grace at PAY_AT
    });
    const result = await useCases.recordPayment(pay());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe('active');
    expect(result.value.balance.minor).toBe(0);
    expect(result.value.paidThroughAt).toBe('2026-07-05T00:00:00.000Z');
    expect(charges.rows().find((c) => c.id === 'chg-open')?.status).toBe(
      'paid',
    );
    expect(payments.rows()).toHaveLength(1);
    expect(payments.rows()[0]?.appliedTo).toEqual(['chg-open']);
    expect(payments.rows()[0]?.reason).toBe('bank transfer');
  });

  it('credits the downtime forward when paid after grace', async () => {
    const { useCases } = makeLedgerWorld({
      sub: postTrial,
      charges: [
        // due 2026-04-05 → suspended since 2026-04-15; 55 days of downtime
        openCharge(
          period('2026-04-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z'),
        ),
      ],
    });
    const result = await useCases.recordPayment(pay());
    expect(result.ok && result.value.phase).toBe('active');
    // paid-through = period end (05-05) + 55 downtime days = 06-29, not 05-05
    expect(result.ok && result.value.paidThroughAt).toBe(
      '2026-06-29T00:00:00.000Z',
    );
  });

  it('voids the stale charge and starts a fresh paid period beyond the cap', async () => {
    const { useCases, charges } = makeLedgerWorld({
      sub: subscription({
        planId: proPlan().id,
        trialEndsAt: '2026-03-01T00:00:00.000Z',
      }),
      plans: [proPlan()],
      charges: [
        // suspended since 2026-01-11 → 149 days > 90 dormant cap
        openCharge(
          period('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
        ),
      ],
    });
    const result = await useCases.recordPayment(pay());
    expect(result.ok && result.value.phase).toBe('active');
    expect(charges.rows().find((c) => c.id === 'chg-open')?.status).toBe(
      'void',
    );
    const fresh = charges.rows().find((c) => c.status === 'paid');
    expect(fresh?.period.from).toBe(PAY_AT);
    expect(result.ok && result.value.paidThroughAt).toBe(
      '2026-07-09T00:00:00.000Z',
    );
  });

  it('denies a recorder without plans.manage', async () => {
    const { useCases } = makeLedgerWorld({
      sub: postTrial,
      charges: [openCharge()],
    });
    const result = await useCases.recordPayment(pay({ actor: outsider }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/access-denied');
  });

  it('fails closed with no subscription', async () => {
    const { useCases } = makeLedgerWorld({ sub: null });
    const result = await useCases.recordPayment(pay());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/subscription-not-found');
  });
});

describe('creditAccount', () => {
  it('settles an open charge as a goodwill credit (free month)', async () => {
    const { useCases, charges, payments } = makeLedgerWorld({
      sub: postTrial,
      charges: [openCharge()],
    });
    const result = await useCases.creditAccount({
      actor: staff,
      accountId: ORG,
      amountMinor: 5684,
      reason: 'goodwill',
    });
    expect(result.ok && result.value.phase).toBe('active');
    expect(charges.rows().find((c) => c.id === 'chg-open')?.status).toBe(
      'paid',
    );
    const credit = payments.rows().find((p) => p.kind === 'credit');
    expect(credit?.reason).toBe('goodwill');
    expect(credit?.appliedTo).toEqual(['chg-open']);
  });
});
