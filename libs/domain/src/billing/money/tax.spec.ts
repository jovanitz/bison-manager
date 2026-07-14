import { describe, expect, it } from 'vitest';
import { money } from './money';
import { applyTaxBps } from './tax';

const mxn = (minor: number) => {
  const r = money(minor, 'MXN');
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

describe('applyTaxBps (IVA, half-up, integer)', () => {
  it('computes 16% IVA on a clean subtotal', () => {
    // $49.00 net → IVA $7.84 → total $56.84
    expect(applyTaxBps(mxn(4900), 1600)).toEqual({
      ok: true,
      value: { subtotal: mxn(4900), tax: mxn(784), total: mxn(5684) },
    });
  });

  it('rounds half-up when the tax has a fractional centavo', () => {
    // 4999 × 1600 / 10000 = 799.84 → 800
    const r = applyTaxBps(mxn(4999), 1600);
    expect(r).toEqual({
      ok: true,
      value: { subtotal: mxn(4999), tax: mxn(800), total: mxn(5799) },
    });
  });

  it('a zero rate leaves subtotal === total', () => {
    expect(applyTaxBps(mxn(4900), 0)).toEqual({
      ok: true,
      value: { subtotal: mxn(4900), tax: mxn(0), total: mxn(4900) },
    });
  });

  it('rejects a negative or non-integer rate', () => {
    expect(applyTaxBps(mxn(4900), -1).ok).toBe(false);
    expect(applyTaxBps(mxn(4900), 16.5).ok).toBe(false);
  });
});
