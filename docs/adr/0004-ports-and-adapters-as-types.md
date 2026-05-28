# ADR-0004: Ports as TypeScript types, adapters as factory functions

- Status: Accepted
- Date: 2026-06-05

## Context

We need to invert dependencies so the core defines what it needs and the outside
world conforms — without classes or interfaces-with-implementations coupling.

## Decision

- A **port** is a plain `type` describing a capability (`ItemRepository`,
  `AuthProvider`, `ApiClient`, `OperationQueue`, `Platform`). Ports live in
  `application` (orchestration ports) or `platform` (device ports).
- An **adapter** is a **factory function** returning a plain object that
  structurally satisfies the port (`createDexieItemRepository(db)`).
- Adapters are interchangeable by construction. The `ItemRepository` contract
  test in `@acme/infrastructure` pins every adapter (in-memory, Dexie, REST) to
  the same behaviour.

## Consequences

- Zero coupling between a consumer and a concrete adapter; the consumer imports
  only the port type (erased at runtime).
- New transport/storage/auth providers are additive — write a new factory, pass
  the contract test, wire it in a composition root.
- Structural typing means an adapter "implements" a port simply by matching its
  shape; there is no `implements` keyword and no inheritance.
