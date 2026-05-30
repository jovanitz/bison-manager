import { type Brand, type Result, err, ok } from '@acme/shared';
import { invalidItemId, invalidItemName } from './errors';
import type { ItemDomainError } from './errors';

/**
 * Value objects.
 *
 * A value object is an immutable, validated wrapper around a primitive. We use
 * branded types so the compiler distinguishes an `ItemId` from any other
 * string, and smart constructors (`make…`) so an invalid value object can never
 * be constructed — validation happens once, at the boundary, and the rest of
 * the domain trusts the type.
 */

export type ItemId = Brand<string, 'ItemId'>;
export type ItemName = Brand<string, 'ItemName'>;

const ITEM_NAME_MAX = 120;

export const makeItemId = (raw: string): Result<ItemId, ItemDomainError> => {
  const value = raw.trim();
  if (value.length === 0) {
    return err(invalidItemId('Item id must not be empty.'));
  }
  return ok(value as ItemId);
};

export const makeItemName = (
  raw: string,
): Result<ItemName, ItemDomainError> => {
  const value = raw.trim();
  if (value.length === 0) {
    return err(invalidItemName('Item name must not be empty.'));
  }
  if (value.length > ITEM_NAME_MAX) {
    return err(
      invalidItemName(
        `Item name must be at most ${ITEM_NAME_MAX} characters.`,
        {
          details: { length: value.length, max: ITEM_NAME_MAX },
        },
      ),
    );
  }
  return ok(value as ItemName);
};

/** The lifecycle states an item may occupy. */
export type ItemStatus = 'active' | 'archived';
