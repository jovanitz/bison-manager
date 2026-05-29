import { type Result, err, ok } from '@acme/shared';
import { itemAlreadyArchived, itemNotArchived } from './errors';
import type { ItemDomainError } from './errors';
import type { ItemArchived, ItemCreated, ItemRenamed, ItemRestored } from './events';
import type { ItemId, ItemName, ItemStatus } from './value-objects';
import { makeItemName } from './value-objects';

/**
 * The Item entity.
 *
 * An entity is immutable data with identity. Every "mutation" is a pure
 * function `(currentItem, …) -> Result<{ item, event }>` that returns a brand
 * new item rather than altering the old one. The domain never reaches for the
 * clock or an id generator — the caller passes those facts in (`occurredAt`,
 * `id`), keeping every function deterministic and trivially testable.
 */
export type Item = {
  readonly id: ItemId;
  readonly name: ItemName;
  readonly status: ItemStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Outcome<Event> = Result<
  { readonly item: Item; readonly event: Event },
  ItemDomainError
>;

export const createItem = (input: {
  readonly id: ItemId;
  readonly name: ItemName;
  readonly occurredAt: string;
}): Outcome<ItemCreated> => {
  const item: Item = {
    id: input.id,
    name: input.name,
    status: 'active',
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  return ok({
    item,
    event: {
      type: 'ItemCreated',
      itemId: item.id,
      name: item.name,
      occurredAt: input.occurredAt,
    },
  });
};

export const renameItem = (
  item: Item,
  rawName: string,
  occurredAt: string,
): Outcome<ItemRenamed> => {
  const named = makeItemName(rawName);
  if (!named.ok) return err(named.error);
  const next: Item = { ...item, name: named.value, updatedAt: occurredAt };
  return ok({
    item: next,
    event: {
      type: 'ItemRenamed',
      itemId: next.id,
      name: next.name,
      occurredAt,
    },
  });
};

export const archiveItem = (
  item: Item,
  occurredAt: string,
): Outcome<ItemArchived> => {
  if (item.status === 'archived') {
    return err(itemAlreadyArchived(`Item ${item.id} is already archived.`));
  }
  const next: Item = { ...item, status: 'archived', updatedAt: occurredAt };
  return ok({
    item: next,
    event: { type: 'ItemArchived', itemId: next.id, occurredAt },
  });
};

export const restoreItem = (
  item: Item,
  occurredAt: string,
): Outcome<ItemRestored> => {
  if (item.status !== 'archived') {
    return err(itemNotArchived(`Item ${item.id} is not archived.`));
  }
  const next: Item = { ...item, status: 'active', updatedAt: occurredAt };
  return ok({
    item: next,
    event: { type: 'ItemRestored', itemId: next.id, occurredAt },
  });
};

/** A read-only predicate — pure domain rule with no side effects. */
export const isItemEditable = (item: Item): boolean => item.status === 'active';

export type { ItemId, ItemName, ItemStatus };
