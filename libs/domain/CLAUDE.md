# libs/domain — `layer:domain`

Pure business model. **May import only `shared`.**

- **Holds:** entities, value objects, business rules, domain events.
- **Forbidden:** `application`/`infrastructure`/`platform`/`ui`; React, browser
  APIs, Dexie, HTTP, auth, native SDKs; classes; decorators; `throw` for expected
  failures.
- **Pattern:** pure functions over immutable data. Return `Result`/`Either` for
  expected failures. Take `clock`/`ids` as parameters — never read the wall clock
  or generate ids directly (keeps it deterministic).

Template: [src/example](src/example) (`item.ts`, `value-objects.ts`).
Rules: [constraints.md](../../docs/ai/constraints.md).
