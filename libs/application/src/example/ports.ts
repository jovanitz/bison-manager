import type { Item, ItemId } from '@acme/domain';
import type { ListOptions } from '../ports/list-options';

/**
 * The repository port for the example module.
 *
 * Note the shape: a plain object type with async methods. No class, no ORM, no
 * SQL, no IndexedDB — those are adapter concerns. The application can be wired
 * against an in-memory map, Dexie, a REST API, or AppSync, and none of the use
 * cases below change. This is the "Ports" half of Ports & Adapters.
 *
 * The repository deals only in domain entities (`Item`), never DTOs or rows.
 */
export type ItemRepository = {
  readonly findById: (id: ItemId) => Promise<Item | null>;
  readonly list: (options?: ListOptions) => Promise<ReadonlyArray<Item>>;
  readonly save: (item: Item) => Promise<void>;
  readonly remove: (id: ItemId) => Promise<void>;
};
