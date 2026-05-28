import { fromItemDto, toItemDto } from '@acme/application';
import type {
  ApiClient,
  ItemDto,
  ItemRepository,
  ListOptions,
} from '@acme/application';

/**
 * Remote (server-of-record) adapter for `ItemRepository`, written purely
 * against the `ApiClient` *port*. It is therefore transport-agnostic: hand it a
 * REST client, a GraphQL client, or a tRPC client and it behaves identically.
 *
 * In the offline-first stack this adapter is wrapped by the local Dexie repo +
 * sync engine; here it represents "the truth on the server".
 */
export const createApiItemRepository = (api: ApiClient): ItemRepository => ({
  findById: async (id) => {
    const res = await api.request<ItemDto>({
      operation: 'getItem',
      method: 'GET',
      path: `items/${id}`,
    });
    return res.ok ? fromItemDto(res.value) : null;
  },
  list: async (opts?: ListOptions) => {
    const res = await api.request<ItemDto[]>({
      operation: 'listItems',
      method: 'GET',
      path: 'items',
      query: { includeArchived: Boolean(opts?.includeArchived) },
    });
    return res.ok ? res.value.map(fromItemDto) : [];
  },
  save: async (item) => {
    await api.request<ItemDto, ItemDto>({
      operation: 'saveItem',
      method: 'PUT',
      path: `items/${item.id}`,
      body: toItemDto(item),
    });
  },
  remove: async (id) => {
    await api.request<void>({
      operation: 'removeItem',
      method: 'DELETE',
      path: `items/${id}`,
    });
  },
});
