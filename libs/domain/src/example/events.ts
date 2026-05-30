import type { ItemId, ItemName } from './value-objects';

/**
 * Domain events.
 *
 * Pure facts about something that has already happened, named in the past
 * tense. Domain functions return events alongside the new state; the
 * application layer decides what to do with them (publish, enqueue for sync,
 * etc.). The domain itself has no idea any of that exists.
 */
export type ItemCreated = {
  readonly type: 'ItemCreated';
  readonly itemId: ItemId;
  readonly name: ItemName;
  readonly occurredAt: string;
};

export type ItemRenamed = {
  readonly type: 'ItemRenamed';
  readonly itemId: ItemId;
  readonly name: ItemName;
  readonly occurredAt: string;
};

export type ItemArchived = {
  readonly type: 'ItemArchived';
  readonly itemId: ItemId;
  readonly occurredAt: string;
};

export type ItemRestored = {
  readonly type: 'ItemRestored';
  readonly itemId: ItemId;
  readonly occurredAt: string;
};

export type ItemEvent = ItemCreated | ItemRenamed | ItemArchived | ItemRestored;
