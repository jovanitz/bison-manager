# Architecture Decision Records

Each ADR captures one significant decision: its context, the decision, and its
consequences. They are immutable once accepted; supersede rather than edit.

| #    | Decision                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| 0001 | [Clean + Hexagonal architecture in an Nx monorepo](0001-clean-hexagonal-architecture.md)                             |
| 0002 | [Functional core — no classes/decorators](0002-functional-no-classes.md)                                             |
| 0003 | [Result/Either for expected failures](0003-result-over-exceptions.md)                                                |
| 0004 | [Ports as types, adapters as factory functions](0004-ports-and-adapters-as-types.md)                                 |
| 0005 | [Composition roots instead of a DI container](0005-composition-roots-no-container.md)                                |
| 0006 | [`shared` foundation layer usable by `domain`](0006-shared-foundation-layer.md)                                      |
| 0007 | [Offline-first: Dexie + outbox + last-write-wins](0007-offline-first-sync.md)                                        |
| 0008 | [Provider-agnostic auth and API](0008-provider-agnostic-auth-and-api.md)                                             |
| 0009 | [Nx monorepo with tag-based boundary enforcement](0009-nx-monorepo-boundaries.md)                                    |
| 0010 | [Authorization via permissions + temporary grants](0010-authorization-permissions-and-grants.md)                     |
| 0011 | [Dynamic roles as the assignment layer + ownership flags](0011-dynamic-roles-and-ownership-flags.md)                 |
| 0012 | [Default role templates (factory baseline) + reset](0012-default-role-templates-and-reset.md)                        |
| 0013 | [Staff-editable default-role templates](0013-staff-editable-role-templates.md)                                       |
| 0014 | [Access model — final shape: roles-only, propagation, extensible scope](0014-access-model-final-shape.md)            |
| 0015 | [Shareable auth — shared identity, per-app embedded authz](0015-shareable-auth-shared-identity-embedded-authz.md)    |
| 0016 | [Plans, subscriptions & entitlements — billing as its own bounded context](0016-plans-subscriptions-entitlements.md) |
| 0017 | [Business verticals (giros) fully isolated — A never knows B exists](0017-giro-isolation.md)                         |
| 0018 | [Payments as a ledger — manual-billing lifecycle, derived coverage](0018-payments-ledger-manual-billing.md)          |
