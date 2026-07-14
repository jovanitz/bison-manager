import { describe, expect, it } from 'vitest';
import { subscription } from '../../billing-subscriptions/testing';
import { ORG, makeLedgerWorld, openCharge, outsider, staff } from '../testing';

const PAY_AT = '2026-06-09T00:00:00.000Z';
const postTrial = subscription({ trialEndsAt: '2026-03-01T00:00:00.000Z' });

const record = async () => {
  const world = makeLedgerWorld({ sub: postTrial, charges: [openCharge()] });
  await world.useCases.recordPayment({
    actor: staff,
    accountId: ORG,
    amountMinor: 5684,
    payAt: PAY_AT,
    reason: 'bank transfer',
  });
  return world;
};

describe('void / refund payment', () => {
  it('void reopens the settled charge and coverage recomputes down', async () => {
    const { useCases, charges, payments } = await record();
    const target = payments.rows()[0];
    const result = await useCases.voidPayment({
      actor: staff,
      paymentId: target?.id ?? '',
      reason: 'recorded twice',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe('grace'); // back in grace at PAY_AT
    expect(result.value.balance.minor).toBe(5684);
    expect(charges.rows().find((c) => c.id === 'chg-open')?.status).toBe(
      'open',
    );
    const reversal = payments.rows().find((p) => p.kind === 'void');
    expect(reversal?.reversalOf).toBe(target?.id);
    expect(reversal?.reason).toBe('recorded twice');
  });

  it('refund has the same coverage effect, tagged as money returned', async () => {
    const { useCases, charges, payments } = await record();
    const target = payments.rows()[0];
    const result = await useCases.refundPayment({
      actor: staff,
      paymentId: target?.id ?? '',
      reason: 'customer left',
    });
    expect(result.ok && result.value.balance.minor).toBe(5684);
    expect(charges.rows().find((c) => c.id === 'chg-open')?.status).toBe(
      'open',
    );
    expect(payments.rows().some((p) => p.kind === 'refund')).toBe(true);
  });

  it('denies a corrector without plans.manage', async () => {
    const { useCases, payments } = await record();
    const target = payments.rows()[0];
    const result = await useCases.voidPayment({
      actor: outsider,
      paymentId: target?.id ?? '',
      reason: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/access-denied');
  });

  it('fails when the payment id is not a reversible payment', async () => {
    const { useCases } = await record();
    const result = await useCases.voidPayment({
      actor: staff,
      paymentId: 'nope',
      reason: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/payment-not-found');
  });
});
