# AI context — Methodology (DDD + TDD)

How we _model_ (Domain-Driven Design) and how we _work_ (Test-Driven
Development). This is not "code style" (that's prettier/eslint/sonarjs/structure)
— it's design and process. The architecture already embodies both; this names the
patterns and makes the rules explicit.

## Domain-Driven Design (tactical)

We use DDD's tactical patterns. The layering in [architecture.md](architecture.md)
is the strategic part (each feature folder ≈ a subdomain; ports = anti-corruption
seams). The tactical patterns and where they live:

| Pattern                 | What it is                                                                                   | Where         | Example                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------- |
| **Value Object**        | Immutable, validated wrapper around a primitive; equality by value                           | `domain`      | `ItemId`, `ItemName` (branded, via `make…` smart constructors) |
| **Entity**              | Immutable data with identity; "mutations" are pure `(entity,…) → Result<{entity,event}>`     | `domain`      | `Item`                                                         |
| **Aggregate**           | An entity that owns a consistency boundary; the only entry point for changes to its contents | `domain`      | `Item` is its own aggregate root                               |
| **Domain Event**        | A fact that happened, named in past tense                                                    | `domain`      | `ItemCreated`, `ItemArchived`                                  |
| **Domain Service**      | A pure operation that doesn't belong to one entity                                           | `domain`      | a pure function over multiple entities                         |
| **Repository (port)**   | Collection-like access to aggregates, as a `type`                                            | `application` | `ItemRepository`                                               |
| **Application Service** | Orchestrates a use case across ports; no business rules of its own                           | `application` | `makeItemUseCases`                                             |
| **Factory**             | Builds a valid aggregate                                                                     | `domain`      | `createItem`                                                   |

### Modeling rules

1. **No primitive obsession.** A concept with rules (an id, a name, an email, a
   money amount) is a **Value Object** with a smart constructor — not a bare
   `string`/`number`. Validation happens once, at construction; the rest of the
   domain trusts the type.
2. **Invariants live in the aggregate.** A rule like "can't archive an archived
   item" is enforced inside the domain function, returning `Result.err` — never in
   a use case or the UI.
3. **State changes emit an event.** Every aggregate mutation returns the new
   aggregate **and** a domain event.
4. **The domain is pure and deterministic.** Clock and ids are parameters
   (`occurredAt`, `id`), never read ambiently.
5. **Speak the ubiquitous language.** Name code with the domain's words (below) —
   the same words the product/users use. If the code and the conversation use
   different words, fix one of them.

## Ubiquitous language (glossary)

The shared vocabulary. **Grow this per feature** — add a row before you model a
new concept, and use exactly these names in code.

| Term          | Meaning                                 | Code                           |
| ------------- | --------------------------------------- | ------------------------------ |
| Item          | A generic example entity (the template) | `Item`                         |
| Archive       | Soft-retire an item (reversible)        | `archiveItem` / `ItemArchived` |
| Restore       | Bring an archived item back to active   | `restoreItem` / `ItemRestored` |
| _(add yours)_ |                                         |                                |

## Test-Driven Development

The architecture is built for TDD: pure core, in-memory adapters, typed ports,
contract tests. Work in **red → green → refactor**:

1. **Red** — write a failing test first.
   - Domain rule → a `*.spec.ts` next to the entity asserting the new behaviour.
   - Use case → a headless spec wiring it to in-memory adapters
     ([use-cases.spec.ts](../../libs/application/src/example/use-cases.spec.ts)).
   - Adapter → register it in the shared contract test.
   - Screen → a component test against mock use cases.
2. **Green** — write the minimum code to pass. Return `Result`, never throw.
3. **Refactor** — clean up with the test as a safety net; keep files small.

### Enforced outcomes (you can't merge un-tested core)

TDD-the-process can't be mechanically proven, but its **outcomes are gated**:

- **`gaps`** blocks the Stop gate and CI when a **use case or adapter has no
  test** (high-severity). So new core code without a test cannot be "done".
- **`coverage`** holds a per-layer floor (domain ≥ 90 %, application ≥ 75 %) in CI.
- **contract tests** prove every adapter satisfies its port.

See [sensors.md](sensors.md) and [workflow.md](workflow.md).
