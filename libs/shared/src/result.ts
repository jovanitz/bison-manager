/**
 * Result / Either type.
 *
 * This is the single most important primitive in the codebase. Business logic
 * never throws for *expected* failures — it returns a `Result`. Throwing is
 * reserved for genuinely unexpected, programmer-error situations.
 *
 * A `Result<T, E>` is either `Ok<T>` (success carrying a value) or
 * `Err<E>` (failure carrying a typed error). Because the error type is part of
 * the signature, callers are forced by the compiler to handle both branches.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

/** Transform the success value, leaving an error untouched. */
export const map =
  <T, U>(fn: (value: T) => U) =>
  <E>(r: Result<T, E>): Result<U, E> =>
    r.ok ? ok(fn(r.value)) : r;

/** Transform the error, leaving a success untouched. */
export const mapErr =
  <E, F>(fn: (error: E) => F) =>
  <T>(r: Result<T, E>): Result<T, F> =>
    r.ok ? r : err(fn(r.error));

/** Chain a fallible operation (monadic bind / flatMap). */
export const flatMap =
  <T, U, E>(fn: (value: T) => Result<U, E>) =>
  (r: Result<T, E>): Result<U, E> =>
    r.ok ? fn(r.value) : r;

/** Unwrap or fall back to a default value. */
export const unwrapOr =
  <T>(fallback: T) =>
  <E>(r: Result<T, E>): T =>
    r.ok ? r.value : fallback;

/**
 * Collapse an array of results into a single result of an array.
 * Short-circuits on the first error — useful for validating many fields.
 */
export const all = <T, E>(
  results: ReadonlyArray<Result<T, E>>,
): Result<T[], E> => {
  const values: T[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    values.push(r.value);
  }
  return ok(values);
};

/** Run a throwing function and capture the throw as an `Err`. */
export const fromThrowable = <T>(fn: () => T): Result<T, unknown> => {
  try {
    return ok(fn());
  } catch (e) {
    return err(e);
  }
};

/** Async variant of `fromThrowable`. */
export const fromPromise = async <T>(
  promise: Promise<T>,
): Promise<Result<T, unknown>> => {
  try {
    return ok(await promise);
  } catch (e) {
    return err(e);
  }
};
