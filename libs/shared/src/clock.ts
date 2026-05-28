/**
 * Time and identity contracts.
 *
 * `Date.now()` and `crypto.randomUUID()` are *ambient* dependencies — they make
 * code non-deterministic and hard to test. We model them as injectable ports so
 * use cases can be driven with a fixed clock and a deterministic id sequence in
 * tests, and with the real thing in production. This is dependency injection by
 * parameter, no container required.
 */
export type Millis = number;

export type Clock = {
  readonly now: () => Date;
  readonly timestamp: () => Millis;
};

export type IdGenerator = {
  readonly next: () => string;
};

/** Real clock backed by the host environment. */
export const systemClock: Clock = {
  now: () => new Date(),
  timestamp: () => Date.now(),
};

/** Frozen clock for deterministic tests. */
export const fixedClock = (instant: Date): Clock => ({
  now: () => new Date(instant),
  timestamp: () => instant.getTime(),
});

/**
 * Real id generator backed by the Web Crypto API, which exists in every target
 * (browsers, Node ≥ 19, WebViews). We reach it through `globalThis` with a
 * local type so `shared` needs neither the DOM nor the Node type libs — keeping
 * it (and therefore `domain`) free of any environment-specific lib.
 */
const webCrypto = (
  globalThis as unknown as { crypto: { randomUUID: () => string } }
).crypto;

export const uuidGenerator: IdGenerator = {
  next: () => webCrypto.randomUUID(),
};

/** Deterministic, monotonically increasing id generator for tests. */
export const sequentialIdGenerator = (prefix = 'id'): IdGenerator => {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
};
