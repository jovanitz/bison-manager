import { bench, describe } from 'vitest';
import {
  archiveItem,
  createItem,
  isItemEditable,
  renameItem,
  restoreItem,
} from './item';
import type { Item } from './item';
import { makeItemId, makeItemName } from './value-objects';

/**
 * Example benchmark for the harness `perf` tool.
 *
 * The domain is a pure, deterministic core (functions take their ids/clock as
 * parameters), which makes it ideal to micro-benchmark: same input, same work,
 * every run. Copy this shape (`*.bench.ts`) for other hot paths.
 */

const at = '2026-01-01T00:00:00.000Z';
const id = makeItemId('item-1');
const name = makeItemName('Sample item');
if (!id.ok || !name.ok) throw new Error('benchmark fixture setup failed');

const created = createItem({ id: id.value, name: name.value, occurredAt: at });
if (!created.ok) throw new Error('benchmark fixture setup failed');
const active: Item = created.value.item;
const maybeArchived = archiveItem(active, at);
const archived: Item = maybeArchived.ok ? maybeArchived.value.item : active;

describe('domain/item pure functions', () => {
  bench('createItem', () => {
    createItem({ id: id.value, name: name.value, occurredAt: at });
  });

  bench('renameItem', () => {
    renameItem(active, 'Renamed item', at);
  });

  bench('archiveItem', () => {
    archiveItem(active, at);
  });

  bench('restoreItem', () => {
    restoreItem(archived, at);
  });

  bench('isItemEditable', () => {
    isItemEditable(active);
  });
});
