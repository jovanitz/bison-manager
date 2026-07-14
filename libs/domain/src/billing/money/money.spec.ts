import { describe, expect, it } from 'vitest';
import {
  addMoney,
  compareMoney,
  isNegative,
  isZero,
  money,
  parseMoney,
  subtractMoney,
  zeroMoney,
} from './money';

const mxn = (minor: number) => {
  const r = money(minor, 'MXN');
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

describe('money (construction)', () => {
  it('accepts an integer number of minor units', () => {
    expect(money(4900, 'MXN')).toEqual({
      ok: true,
      value: { minor: 4900, currency: 'MXN' },
    });
  });

  it('rejects a non-integer (someone passed pesos, not centavos)', () => {
    const r = money(49.5, 'MXN');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-money');
  });

  it('rejects an unsafe integer', () => {
    expect(money(Number.MAX_SAFE_INTEGER + 1, 'MXN').ok).toBe(false);
  });
});

describe('money (arithmetic)', () => {
  it('adds and subtracts within a currency', () => {
    expect(addMoney(mxn(4900), mxn(784))).toEqual({
      ok: true,
      value: mxn(5684),
    });
    expect(subtractMoney(mxn(4900), mxn(900))).toEqual({
      ok: true,
      value: mxn(4000),
    });
  });

  it('orders with compareMoney', () => {
    expect(compareMoney(mxn(100), mxn(200))).toEqual({ ok: true, value: -1 });
    expect(compareMoney(mxn(200), mxn(200))).toEqual({ ok: true, value: 0 });
    expect(compareMoney(mxn(300), mxn(200))).toEqual({ ok: true, value: 1 });
  });

  it('zero / isZero / isNegative helpers', () => {
    expect(isZero(zeroMoney('MXN'))).toBe(true);
    expect(isNegative(mxn(-1))).toBe(true);
    expect(isNegative(mxn(0))).toBe(false);
  });
});

describe('parseMoney (float-free)', () => {
  it('scales by the currency exponent', () => {
    expect(parseMoney('49.99', 'MXN')).toEqual({ ok: true, value: mxn(4999) });
    expect(parseMoney('49', 'MXN')).toEqual({ ok: true, value: mxn(4900) });
    expect(parseMoney('49.9', 'MXN')).toEqual({ ok: true, value: mxn(4990) });
  });

  it('never loses a centavo — the whole reason we avoid floats', () => {
    // parseFloat("49.99") * 100 === 4998.9999… ; ours is exact.
    const sum = addMoney(mxn(10), mxn(20)); // 0.10 + 0.20
    expect(sum).toEqual({ ok: true, value: mxn(30) }); // exactly $0.30, not 0.30000000004
    expect(parseMoney('0.10', 'MXN')).toEqual({ ok: true, value: mxn(10) });
  });

  it('rejects too many decimals for the currency', () => {
    expect(parseMoney('49.999', 'MXN').ok).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    expect(parseMoney('$49', 'MXN').ok).toBe(false);
    expect(parseMoney('abc', 'MXN').ok).toBe(false);
  });
});
