import { describe, expect, it } from 'vitest';
import {
  archiveItem,
  createItem,
  isEditable,
  renameItem,
  restoreItem,
} from './item';
import { makeItemId, makeItemName } from './value-objects';

const at = '2026-01-01T00:00:00.000Z';

const newItem = (name = 'Widget') => {
  const id = makeItemId('item-1');
  const nm = makeItemName(name);
  if (!id.ok || !nm.ok) throw new Error('fixture invalid');
  const created = createItem({ id: id.value, name: nm.value, occurredAt: at });
  if (!created.ok) throw new Error('create failed');
  return created.value.item;
};

describe('Item value objects', () => {
  it('rejects empty names', () => {
    const r = makeItemName('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-item-name');
  });

  it('rejects overly long names', () => {
    const r = makeItemName('x'.repeat(200));
    expect(r.ok).toBe(false);
  });
});

describe('createItem', () => {
  it('produces an active item and an ItemCreated event', () => {
    const item = newItem();
    expect(item.status).toBe('active');
    expect(isEditable(item)).toBe(true);
  });
});

describe('renameItem', () => {
  it('updates the name and emits an event', () => {
    const r = renameItem(newItem(), 'Gadget', at);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.item.name).toBe('Gadget');
      expect(r.value.event.type).toBe('ItemRenamed');
    }
  });

  it('rejects invalid names without mutating the original', () => {
    const original = newItem();
    const r = renameItem(original, '', at);
    expect(r.ok).toBe(false);
    expect(original.name).toBe('Widget');
  });
});

describe('archive / restore lifecycle', () => {
  it('archives an active item', () => {
    const r = archiveItem(newItem(), at);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.item.status).toBe('archived');
  });

  it('refuses to archive an already-archived item', () => {
    const archived = archiveItem(newItem(), at);
    if (!archived.ok) throw new Error('setup');
    const again = archiveItem(archived.value.item, at);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.tag).toBe('domain/item-already-archived');
  });

  it('restores an archived item', () => {
    const archived = archiveItem(newItem(), at);
    if (!archived.ok) throw new Error('setup');
    const restored = restoreItem(archived.value.item, at);
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.value.item.status).toBe('active');
  });

  it('refuses to restore an item that is not archived', () => {
    const r = restoreItem(newItem(), at);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/item-not-archived');
  });
});
