import { z } from 'zod';
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
  /** Persisted-shape version; bump on every change to the fields below. */
  readonly schemaVersion: number;
  readonly id: string;
  readonly name: string;
  readonly status: ItemStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * Current persisted shape. Stamped on every record (via `toItemDto`) so a client
 * still holding an OLDER record in IndexedDB can be migrated when it is read back
 * — even across app deploys. Bump this whenever the field shape changes, and add
 * the matching migration step in `parseItemDto`.
 */
export const ITEM_DTO_VERSION = 1;

export const toItemDto = (item: Item): ItemDto => ({
  schemaVersion: ITEM_DTO_VERSION,
  id: item.id,
  name: item.name,
  status: item.status,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

/**
 * The shape we accept FROM storage. Deliberately lenient about `schemaVersion`
 * (records written before it existed default to 0, so they migrate instead of
 * being dropped) yet strict about identity/shape (a corrupt record fails and the
 * caller drops it). IndexedDB's `stores(...)` declaration only governs
 * keys/indexes, never the field shape — so THIS codec, not Dexie, is what stops
 * a field-level model change from corrupting reads.
 */
const persistedItemSchema = z.object({
  schemaVersion: z.number().int().nonnegative().catch(0),
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['active', 'archived']),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

/**
 * Migrate-on-read: normalize a persisted (possibly older or corrupt) record to
 * the current `ItemDto`, or return `null` if it is unusable (the caller drops
 * it). Each future schema bump adds a migration step here, keyed on the incoming
 * `schemaVersion`, before the final re-stamp.
 */
export const parseItemDto = (raw: unknown): ItemDto | null => {
  const parsed = persistedItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;
  // (future) migrate by `data.schemaVersion` here before the final re-stamp.
  return {
    schemaVersion: ITEM_DTO_VERSION,
    id: data.id,
    name: data.name,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

/**
 * Reconstitute a domain entity from a DTO that has ALREADY been validated by
 * `parseItemDto` (so it casts back to the branded types). Never call this on a
 * raw record straight out of storage — run it through `parseItemDto` first.
 */
export const fromItemDto = (dto: ItemDto): Item => ({
  id: dto.id as ItemId,
  name: dto.name as ItemName,
  status: dto.status,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});
