/**
 * Generic, feature-agnostic list/query options.
 *
 * This is shared application kernel — NOT part of any one feature module — so it
 * is defined once and reused by every feature's repository port. Feature modules
 * import it; they must not redefine it (that would collide in the barrel and
 * break `export *` when more than one feature exists).
 */
export type ListOptions = {
  readonly includeArchived?: boolean;
};
