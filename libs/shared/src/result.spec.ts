import { describe, expect, it } from 'vitest';
import { all, err, flatMap, isErr, isOk, map, ok, unwrapOr } from './result';

describe('Result', () => {
  it('constructs ok and err values', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('narrows with isOk / isErr', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('x'))).toBe(true);
  });

  it('maps over the success branch only', () => {
    expect(map((n: number) => n + 1)(ok(1))).toEqual(ok(2));
    expect(map((n: number) => n + 1)(err('e'))).toEqual(err('e'));
  });

  it('chains fallible operations with flatMap', () => {
    const parse = (s: string) =>
      Number.isNaN(Number(s)) ? err('NaN') : ok(Number(s));
    expect(flatMap(parse)(ok('42'))).toEqual(ok(42));
    expect(flatMap(parse)(ok('nope'))).toEqual(err('NaN'));
  });

  it('collects results, short-circuiting on first error', () => {
    expect(all([ok(1), ok(2), ok(3)])).toEqual(ok([1, 2, 3]));
    expect(all([ok(1), err('bad'), ok(3)])).toEqual(err('bad'));
  });

  it('falls back with unwrapOr', () => {
    expect(unwrapOr(0)(ok(5))).toBe(5);
    expect(unwrapOr(0)(err('e'))).toBe(0);
  });
});
