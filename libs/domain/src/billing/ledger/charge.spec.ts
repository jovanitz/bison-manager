import { describe, expect, it } from 'vitest';
import type { PlanId } from '../plan/plan';
import { money } from '../money/money';
import { createCharge } from './charge';

const subtotal = () => {
  const r = money(4900, 'MXN'); // $49.00 net
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

const input = () => ({
  accountId: 'org_11',
  planId: 'plan_pro' as PlanId,
  period: { from: '2026-05-05', to: '2026-06-05' },
  subtotal: subtotal(),
  taxRateBps: 1600,
  graceDays: 10,
});

const deps = { ids: () => 'chg_1' };

describe('createCharge (snapshot price + tax + grace)', () => {
  it('snapshots subtotal, computes IVA + total, anchors dueDate to period.from', () => {
    const r = createCharge(input(), deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      id: 'chg_1',
      dueDate: '2026-05-05',
      subtotal: { minor: 4900 },
      tax: { minor: 784 },
      total: { minor: 5684 },
      taxRateBps: 1600,
      graceDays: 10,
      status: 'open',
    });
  });

  it('rejects a non-ISO period date', () => {
    const r = createCharge(
      { ...input(), period: { from: 'nope', to: '2026-06-05' } },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-billing-date');
  });

  it('rejects a negative grace-days policy', () => {
    const r = createCharge({ ...input(), graceDays: -1 }, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-billing-policy');
  });

  it('propagates a bad tax rate', () => {
    expect(createCharge({ ...input(), taxRateBps: -1 }, deps).ok).toBe(false);
  });
});
