/**
 * Generic outbound port for publishing domain events.
 *
 * A *port* is just a TypeScript type describing a capability the application
 * needs from the outside world. There is no class and no implementation here —
 * adapters in the infrastructure/platform layers satisfy this shape, and the
 * composition root injects one. The application depends on the abstraction, the
 * abstraction depends on nothing (Dependency Inversion).
 */
export type DomainEventLike = { readonly type: string };

export type EventPublisher = {
  readonly publish: (events: ReadonlyArray<DomainEventLike>) => Promise<void>;
};

/** A publisher that drops everything — a safe default for tests. */
export const nullEventPublisher: EventPublisher = {
  publish: async () => undefined,
};
