/**
 * Branded (nominal) types.
 *
 * TypeScript is structurally typed, so `string` is `string` everywhere. A brand
 * lets us mint distinct types that are still backed by a primitive at runtime —
 * e.g. an `ItemId` cannot be accidentally passed where a `UserId` is expected,
 * even though both are strings. This is how value objects get their identity
 * without classes.
 */
declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & {
  readonly [brand]: TBrand;
};
