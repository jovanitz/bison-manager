import type { Item, ItemId, ItemName, ItemStatus } from '@acme/domain';

/**
 * Data Transfer Objects.
 *
 * DTOs are the plain, serializable view of an entity that crosses a boundary —
 * over the wire, into a store, or up to the UI. They use raw primitives (no
 * branded types) so React, JSON, and IndexedDB can all handle them without
 * knowing about the domain. Mapping happens in exactly one place, here, so the
 * domain stays sealed off from serialization concerns.
 */
export type ItemDto = {
  readonly id: string;
  readonly name: string;
  readonly status: ItemStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export const toItemDto = (item: Item): ItemDto => ({
  id: item.id,
  name: item.name,
  status: item.status,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

/**
 * Reconstitute a domain entity from a persisted DTO. This trusts that the data
 * was valid when it was written (it passed value-object validation on the way
 * in), so it casts back to the branded types rather than re-validating.
 */
export const fromItemDto = (dto: ItemDto): Item => ({
  id: dto.id as ItemId,
  name: dto.name as ItemName,
  status: dto.status,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});
