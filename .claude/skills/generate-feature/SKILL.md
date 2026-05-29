---
name: generate-feature
description: Scaffold a new vertical-slice feature in the Acme monorepo from the Item example template, then wire and verify it. Use when the user asks to "create a new feature", "add a feature", "scaffold/generate a <thing> module", or start a new entity end-to-end (domain → application → infrastructure → ui).
---

# generate-feature

A two-part workflow: a **generator** writes the slice files (deterministic), then
**you** wire the bespoke parts (judgment) and verify with **sensors**. The
generator is not a sensor — see [docs/ai/harness.md](../../../docs/ai/harness.md).

## 1. Generate the files

```bash
pnpm harness generate-feature <name>     # single lowercase word, e.g. order, invoice
```

It copies the `example` slice into `<name>` across domain, application,
infrastructure (in-memory repo + contract) and ui, renaming identifiers
(`Item`→`<Name>`), and appends the `index.ts` barrel exports. Output is JSON with
`created`, `wired`, and `nextSteps`. After this, **domain/application/
infrastructure compile and test on their own**; the UI typecheck stays red until
step 2a.

## 2. Wire the bespoke parts (the generator does NOT touch these)

Follow the `nextSteps` from the JSON:

- **2a. Extend `AppUseCases`** in `libs/ui/src/di/use-cases-context.tsx`: import
  `type { <Name>UseCases } from '@acme/application'` and add
  `readonly <name>s: <Name>UseCases;`.
- **2b. Wire each composition root** (`apps/{web,mobile,desktop}/src/composition-root.ts`):
  build `make<Name>UseCases({ repository, clock, ids, events, logger })` and add
  `<name>s` to the returned `useCases` — mirror how `items` is wired. Pick a
  repository adapter (the in-memory one for a quick start, or the Dexie/offline
  stack like items).
- **2c. Replace the copied example logic** with the real `<Name>` domain rules,
  value objects, DTO and screen.

## 3. Verify

```bash
pnpm harness quality     # lint + typecheck + test must be green
pnpm harness gaps        # confirm no untested adapters/use-cases were introduced
```

## Convention (why the generator scales)

Feature-module exports **must embed the entity token** (e.g. `isItemEditable`,
`ItemUseCaseResult`), and genuinely-generic types live in the shared kernel
(`libs/application/src/ports/`), not in a feature module. Otherwise two features
would export the same name and break the barrel `export *`. See
[docs/ai/constraints.md](../../../docs/ai/constraints.md).
