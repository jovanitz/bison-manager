import {
  type Clock,
  type IdGenerator,
  type Logger,
  type Result,
  err,
  ok,
} from '@acme/shared';
import {
  archiveItem,
  createItem,
  makeItemId,
  makeItemName,
  renameItem,
  restoreItem,
} from '@acme/domain';
import type { EventPublisher } from '../ports/event-publisher';
import { type ItemDto, toItemDto } from './dto';
import { type ItemUseCaseError, itemNotFound } from './errors';
import type { ItemRepository } from './ports';
import type { ListOptions } from '../ports/list-options';

/**
 * Use case dependencies.
 *
 * Every use case is a factory function that receives this bundle of *ports* and
 * returns the executable use case. The dependencies are explicit and injected —
 * there is no container, no `import` of a concrete adapter, no singleton. Swap
 * `repository` for an in-memory fake and the same use case runs in a unit
 * test, unchanged.
 */
export type ItemUseCaseDeps = {
  readonly repository: ItemRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly events: EventPublisher;
  readonly logger: Logger;
};

export type ItemUseCaseResult = Promise<Result<ItemDto, ItemUseCaseError>>;

/* ---------- Commands ---------- */

export const makeCreateItem =
  (deps: ItemUseCaseDeps) =>
  async (input: { name: string }): ItemUseCaseResult => {
    const id = makeItemId(deps.ids.next());
    if (!id.ok) return err(id.error);
    const name = makeItemName(input.name);
    if (!name.ok) return err(name.error);

    const created = createItem({
      id: id.value,
      name: name.value,
      occurredAt: deps.clock.now().toISOString(),
    });
    if (!created.ok) return err(created.error);

    await deps.repository.save(created.value.item);
    await deps.events.publish([created.value.event]);
    deps.logger.info('item.created', { itemId: created.value.item.id });
    return ok(toItemDto(created.value.item));
  };

export const makeRenameItem =
  (deps: ItemUseCaseDeps) =>
  async (input: { id: string; name: string }): ItemUseCaseResult => {
    const id = makeItemId(input.id);
    if (!id.ok) return err(id.error);

    const existing = await deps.repository.findById(id.value);
    if (!existing) return err(itemNotFound(`No item with id ${input.id}.`));

    const renamed = renameItem(
      existing,
      input.name,
      deps.clock.now().toISOString(),
    );
    if (!renamed.ok) return err(renamed.error);

    await deps.repository.save(renamed.value.item);
    await deps.events.publish([renamed.value.event]);
    return ok(toItemDto(renamed.value.item));
  };

export const makeArchiveItem =
  (deps: ItemUseCaseDeps) =>
  async (input: { id: string }): ItemUseCaseResult => {
    const id = makeItemId(input.id);
    if (!id.ok) return err(id.error);

    const existing = await deps.repository.findById(id.value);
    if (!existing) return err(itemNotFound(`No item with id ${input.id}.`));

    const archived = archiveItem(existing, deps.clock.now().toISOString());
    if (!archived.ok) return err(archived.error);

    await deps.repository.save(archived.value.item);
    await deps.events.publish([archived.value.event]);
    return ok(toItemDto(archived.value.item));
  };

export const makeRestoreItem =
  (deps: ItemUseCaseDeps) =>
  async (input: { id: string }): ItemUseCaseResult => {
    const id = makeItemId(input.id);
    if (!id.ok) return err(id.error);

    const existing = await deps.repository.findById(id.value);
    if (!existing) return err(itemNotFound(`No item with id ${input.id}.`));

    const restored = restoreItem(existing, deps.clock.now().toISOString());
    if (!restored.ok) return err(restored.error);

    await deps.repository.save(restored.value.item);
    await deps.events.publish([restored.value.event]);
    return ok(toItemDto(restored.value.item));
  };

/* ---------- Queries ---------- */

export const makeListItems =
  (deps: ItemUseCaseDeps) =>
  async (options?: ListOptions): Promise<ReadonlyArray<ItemDto>> => {
    const items = await deps.repository.list(options);
    return items.map(toItemDto);
  };

export const makeGetItem =
  (deps: ItemUseCaseDeps) =>
  async (input: { id: string }): ItemUseCaseResult => {
    const id = makeItemId(input.id);
    if (!id.ok) return err(id.error);
    const item = await deps.repository.findById(id.value);
    if (!item) return err(itemNotFound(`No item with id ${input.id}.`));
    return ok(toItemDto(item));
  };

/**
 * Convenience aggregate: build every example use case from one dependency
 * bundle. The composition root calls this once and hands the result to the UI.
 */
export type ItemUseCases = {
  readonly create: ReturnType<typeof makeCreateItem>;
  readonly rename: ReturnType<typeof makeRenameItem>;
  readonly archive: ReturnType<typeof makeArchiveItem>;
  readonly restore: ReturnType<typeof makeRestoreItem>;
  readonly list: ReturnType<typeof makeListItems>;
  readonly get: ReturnType<typeof makeGetItem>;
};

export const makeItemUseCases = (deps: ItemUseCaseDeps): ItemUseCases => ({
  create: makeCreateItem(deps),
  rename: makeRenameItem(deps),
  archive: makeArchiveItem(deps),
  restore: makeRestoreItem(deps),
  list: makeListItems(deps),
  get: makeGetItem(deps),
});
