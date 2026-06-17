/**
 * Tiny dependency-free engine for property-based testing + exhaustive BFS model
 * checking. Co-located with the formal specs on purpose: it adds no npm dep
 * (pnpm-lock is protected) and no production-barrel pollution. It is the static
 * half of a Runtime Inspector's `formal_run_properties` / `formal_model_check`.
 *
 * Determinism: each sample uses a fixed, derived seed, so a failure is
 * reproducible by re-running — the thrown message carries the seed and input.
 */
export type Rng = () => number;

/** mulberry32 — small, fast, seedable PRNG in [0, 1). */
export const makeRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T>(rng: Rng, xs: ReadonlyArray<T>): T =>
  xs[Math.floor(rng() * xs.length)] as T;

export const chance = (rng: Rng, p = 0.5): boolean => rng() < p;

/**
 * Run `prop` over `count` generated samples. Throws on the FIRST failure with a
 * reproducible seed + the offending input — the gold outcome (a counterexample).
 */
export const forAll = <T>(
  name: string,
  count: number,
  gen: (rng: Rng) => T,
  prop: (x: T) => boolean,
): void => {
  for (let i = 0; i < count; i++) {
    const seed = Math.imul(i + 1, 2654435761) >>> 0 || 1;
    const x = gen(makeRng(seed));
    let held = false;
    try {
      held = prop(x);
    } catch {
      held = false;
    }
    if (!held) {
      throw new Error(
        `Property "${name}" failed at seed=${seed}: ${JSON.stringify(x)}`,
      );
    }
  }
};

/**
 * Exhaustive BFS over a FINITE transition system. Explores every reachable
 * state and returns the first invariant violation (if any) plus the count.
 */
export const exploreBfs = <S>(input: {
  readonly start: ReadonlyArray<S>;
  readonly key: (s: S) => string;
  readonly next: (s: S) => ReadonlyArray<S>;
  readonly invariant: (s: S) => boolean;
}): { readonly explored: number; readonly violation: S | null } => {
  const seen = new Set<string>();
  const queue: S[] = [];
  for (const s of input.start) {
    const k = input.key(s);
    if (!seen.has(k)) {
      seen.add(k);
      queue.push(s);
    }
  }
  let violation: S | null = null;
  while (queue.length > 0) {
    const s = queue.shift() as S;
    if (violation === null && !input.invariant(s)) violation = s;
    for (const n of input.next(s)) {
      const k = input.key(n);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return { explored: seen.size, violation };
};
