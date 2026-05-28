import { defineError, type TaggedError } from '@acme/shared';

/**
 * Domain errors for the example module.
 *
 * These represent *business rule violations* — not infrastructure failures.
 * They are pure data, returned (never thrown) from domain functions, so callers
 * handle them exhaustively.
 */
export const invalidItemName = defineError('domain/invalid-item-name');
export const invalidItemId = defineError('domain/invalid-item-id');
export const itemAlreadyArchived = defineError('domain/item-already-archived');
export const itemNotArchived = defineError('domain/item-not-archived');

export type ItemDomainError =
  | TaggedError<'domain/invalid-item-name'>
  | TaggedError<'domain/invalid-item-id'>
  | TaggedError<'domain/item-already-archived'>
  | TaggedError<'domain/item-not-archived'>;
