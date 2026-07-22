import { describe, expect, it } from 'vitest';
import type { Payment, PaymentId } from '@acme/domain';
import {
  ORG,
  makeLedgerWorld,
  openCharge,
  outsider,
  paidCharge,
  staff,
} from '../testing';
import { projectLedger } from './list-ledger';

const mxn = (minor: number) => ({ minor, currency: 'MXN' as const });

const payment = (over: Partial<Payment>): Payment => ({
  id: 'pay-1' as PaymentId,
  accountId: ORG,
  kind: 'payment',
  amount: mxn(5684),
  appliedTo: [],
  recordedByMembershipId: 'm-1',
  reason: 'bank transfer',
  occurredAt: '2026-06-06T00:00:00.000Z',
  ...over,
});

describe('projectLedger (pure)', () => {
  it('signs movements from the customer-owes view and carries a running balance', () => {
    const charge = openCharge({ dueDate: '2026-06-05T00:00:00.000Z' });
    const pay = payment({ occurredAt: '2026-06-06T00:00:00.000Z' });
    const { entries } = projectLedger([charge], [pay], 'MXN');
    // chronological: charge (+5684) then payment (−5684) → balance 5684 then 0.
    expect(entries.map((e) => e.kind)).toEqual(['charge', 'payment']);
    expect(entries[0]?.amountMinor).toBe(5684);
    expect(entries[0]?.runningBalanceMinor).toBe(5684);
    expect(entries[1]?.amountMinor).toBe(-5684);
    expect(entries[1]?.runningBalanceMinor).toBe(0);
  });

  it('re-owes on refund/void and converges to the domain open-charge balance', () => {
    // A reopened (voided) charge is open again → its running total ends at +total,
    // matching deriveCoverage (sum of open charges).
    const charge = openCharge({
      status: 'open',
      dueDate: '2026-06-05T00:00:00.000Z',
    });
    const pay = payment({ occurredAt: '2026-06-06T00:00:00.000Z' });
    const voidP = payment({
      id: 'pay-void' as PaymentId,
      kind: 'void',
      reversalOf: 'pay-1' as PaymentId,
      occurredAt: '2026-06-07T00:00:00.000Z',
      reason: 'duplicate',
    });
    const { entries } = projectLedger([charge], [pay, voidP], 'MXN');
    expect(entries.map((e) => e.runningBalanceMinor)).toEqual([5684, 0, 5684]);
    expect(entries[2]?.kind).toBe('void');
    expect(entries[2]?.reason).toBe('duplicate');
  });

  it('carries the tax split + status on charge entries, id = underlying id', () => {
    const charge = paidCharge();
    const [entry] = projectLedger([charge], [], 'MXN').entries;
    expect(entry?.id).toBe(charge.id);
    expect(entry?.chargeStatus).toBe('paid');
    expect(entry?.subtotalMinor).toBe(4900);
    expect(entry?.taxMinor).toBe(784);
    expect(entry?.period).toEqual(charge.period);
  });

  it("a payment entry's id is the payment id (what void/refund target)", () => {
    const [entry] = projectLedger(
      [],
      [payment({ id: 'pay-42' as PaymentId })],
      'MXN',
    ).entries;
    expect(entry?.id).toBe('pay-42');
    expect(entry?.kind).toBe('payment');
  });
});

describe('makeListLedger (authorized read)', () => {
  it('staff (billing.read:any) reads the org ledger', async () => {
    const world = makeLedgerWorld({ charges: [openCharge()] });
    await world.payments.append(payment({}));
    const result = await world.useCases.listLedger({
      actor: staff,
      accountId: ORG,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.entries).toHaveLength(2);
  });

  it('denies a customer admin on another account', async () => {
    const world = makeLedgerWorld({ charges: [openCharge()] });
    const result = await world.useCases.listLedger({
      actor: outsider,
      accountId: ORG,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
  });

  it('returns an empty ledger (never a 404) for an org with no movements', async () => {
    const world = makeLedgerWorld({ charges: [] });
    const result = await world.useCases.listLedger({
      actor: staff,
      accountId: ORG,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.entries).toEqual([]);
  });
});
