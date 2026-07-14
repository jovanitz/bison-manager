import { describe, expect, it } from 'vitest';
import type { PlanId } from '../plan/plan';
import { money } from '../money/money';
import { createCharge } from './charge';
import { applyPayment, downtimeDays, settleCharge } from './settle';
import type { Charge } from './ledger';

const POLICY = { dormantDays: 90 };
const mxn = (minor: number) => {
  const r = money(minor, 'MXN');
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

// Charge for May: period [5 May, 5 Jun), due 5 May, grace 10 → suspends 15 May,
// total $56.84 (5684).
const mayCharge = (): Charge => {
  const r = createCharge(
    {
      accountId: 'org_11',
      planId: 'plan_pro' as PlanId,
      period: { from: '2026-05-05', to: '2026-06-05' },
      subtotal: mxn(4900),
      taxRateBps: 1600,
      graceDays: 10,
    },
    { ids: () => 'chg' },
  );
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

describe('downtimeDays', () => {
  it('is 0 when paid within grace (service never stopped)', () => {
    expect(downtimeDays(mayCharge(), '2026-05-12')).toBe(0);
  });
  it('counts the days without service after grace elapsed', () => {
    expect(downtimeDays(mayCharge(), '2026-05-18')).toBe(3); // off 15→18 May
  });
});

describe('settleCharge', () => {
  it('paying within grace does NOT move the renewal date', () => {
    const r = settleCharge(mayCharge(), '2026-05-12', POLICY);
    if (r.kind !== 'settled') throw new Error('expected settled');
    expect(r.charge.status).toBe('paid');
    expect(r.charge.paidAt).toBe('2026-05-12');
    expect(r.charge.coveredThrough).toBe('2026-06-05T00:00:00.000Z'); // = period.to
  });

  it('paying after 3 days suspended shifts coverage +3 days', () => {
    const r = settleCharge(mayCharge(), '2026-05-18', POLICY);
    if (r.kind !== 'settled') throw new Error('expected settled');
    expect(r.charge.coveredThrough).toBe('2026-06-08T00:00:00.000Z'); // 5 Jun + 3
  });

  it('signals beyond-cap when suspended past the dormant window', () => {
    // 15 May → 20 Sep ≈ 128 days off > 90 → fresh start, not credit
    expect(settleCharge(mayCharge(), '2026-09-20', POLICY)).toEqual({
      kind: 'beyond-cap',
    });
  });
});

const apply = (
  charges: readonly Charge[],
  amount: number,
  payAt = '2026-05-12',
) =>
  applyPayment({
    openCharges: charges,
    amount: mxn(amount),
    payAt,
    policy: POLICY,
  });

describe('applyPayment (FIFO, whole-charge, credit)', () => {
  it('settles a charge paid in full and leaves no credit', () => {
    const r = apply([mayCharge()], 5684);
    expect(r.settled).toHaveLength(1);
    expect(r.settled[0]?.status).toBe('paid');
    expect(r.credit).toEqual(mxn(0));
    expect(r.freshStart).toBe(false);
  });

  it('overpayment leaves a credit balance', () => {
    const r = apply([mayCharge()], 6000);
    expect(r.settled).toHaveLength(1);
    expect(r.credit).toEqual(mxn(316)); // 6000 − 5684
  });

  it('an underpayment settles nothing — held as credit (no partial coverage)', () => {
    const r = apply([mayCharge()], 3000);
    expect(r.settled).toHaveLength(0);
    expect(r.credit).toEqual(mxn(3000));
  });

  it('settles multiple open charges FIFO from one payment', () => {
    const r = apply([mayCharge(), mayCharge()], 5684 * 2);
    expect(r.settled).toHaveLength(2);
    expect(r.credit).toEqual(mxn(0));
  });

  it('voids the stale charge and signals fresh-start past the dormant cap', () => {
    const r = apply([mayCharge()], 5684, '2026-09-20');
    expect(r.settled).toHaveLength(0);
    expect(r.voided).toHaveLength(1);
    expect(r.voided[0]?.status).toBe('void');
    expect(r.freshStart).toBe(true);
  });
});
