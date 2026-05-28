# Guideline: Creating a new feature

Follow the layers inside-out. Use the `example` module (the `Item` feature) as a
copy-paste template — every file referenced below has a counterpart there.

> Golden rule: **start in the domain, finish in a composition root.** If you find
> yourself importing React or Dexie in the domain or application, stop — the
> dependency belongs behind a port.

## 1. Domain (`libs/domain/src/<feature>/`)

1. Define **value objects** with smart constructors returning `Result`
   (`value-objects.ts`).
2. Define the **entity** as an immutable `readonly` record (`<entity>.ts`).
3. Write **domain rules** as pure functions
   `(entity, …inputs, occurredAt) -> Result<{ entity, event }, DomainError>`.
   Never call `Date.now()`/`randomUUID()` — take them as arguments.
4. Define **domain errors** (`defineError`) and **events** (past tense).
5. Tests need no React/UI (`<entity>.spec.ts`).

## 2. Application (`libs/application/src/<feature>/`)

1. Define the **repository port** and any other ports the use cases need
   (`ports.ts`).
2. Define **DTOs** + `to…Dto`/`from…Dto` mappers (`dto.ts`).
3. Define **application errors** (`errors.ts`) — usually `DomainError | NotFound`.
4. Write **use cases** as factories `(deps) => (input) => Promise<Result<…>>`
   (`use-cases.ts`), and a `make<Feature>UseCases(deps)` aggregate.
5. Test use cases with an in-memory repo — no UI.

## 3. Infrastructure (`libs/infrastructure/src/`)

1. Implement the repository port for each backing store you need
   (in-memory + Dexie + API). Plain factory functions.
2. Add the adapters to the **contract test** so they are provably interchangeable.

## 4. UI (`libs/ui/src/<feature>/`)

1. Add the feature's use cases to `AppUseCases` (`di/use-cases-context.tsx`).
2. Write TanStack Query hooks that call **only** the use cases (`use-<feature>.ts`).
3. Build the screen/form from the design system (`<feature>-screen.tsx`,
   RHF + Zod for forms). Never import infrastructure or platform here.
4. Component-test the screen with mock use cases.

## 5. Wire it (composition roots)

1. Add the feature's use cases to each app's composition root.
2. Add a component test that renders the screen against mock use cases (and,
   for offline behaviour, against the in-memory queue + sync engine), so the
   feature can be exercised in isolation.

## Checklist

- [ ] Domain pure & tested, no framework imports
- [ ] Ports defined before adapters
- [ ] Adapters pass the contract test
- [ ] UI depends only on `application` + `shared`
- [ ] Wired in every composition root
- [ ] `nx affected -t lint typecheck test` is green
