/**
 * Error helpers.
 *
 * Errors are modelled as plain, immutable, discriminated data — not thrown
 * class instances. A `TaggedError` carries a string `tag` for exhaustive
 * `switch` handling, a human message, and optional structured details. This
 * keeps errors serializable (they cross the network and IndexedDB happily) and
 * pattern-matchable.
 */
export type TaggedError<Tag extends string = string> = {
  readonly tag: Tag;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
};

export const makeError = <Tag extends string>(
  tag: Tag,
  message: string,
  extra?: Pick<TaggedError<Tag>, 'details' | 'cause'>,
): TaggedError<Tag> => ({
  tag,
  message,
  ...(extra?.details ? { details: extra.details } : {}),
  ...(extra?.cause ? { cause: extra.cause } : {}),
});

/** Factory for a family of errors that share a tag. */
export const defineError =
  <Tag extends string>(tag: Tag) =>
  (
    message: string,
    extra?: Pick<TaggedError<Tag>, 'details' | 'cause'>,
  ): TaggedError<Tag> =>
    makeError(tag, message, extra);

/** Narrow an `unknown` thrown value into a readable string. */
export const toMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : String(e);
