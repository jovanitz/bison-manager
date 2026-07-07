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

### The three test levels — `unit` · `integration (simulated)` · `e2e`

Keep these separate; they answer different questions. **The level is defined by
_what a test wires_, not by which vitest `environment` it runs in** (the
environment only says whether a DOM is available — jsdom/happy-dom/Node — it is
not the test level). And the primary axis is **simulated vs real**: everything
below e2e runs simulated — no real browser, no real DB, no network, in-memory
adapters — so it stays fast and deterministic. **e2e is the only level that runs
the real thing** (a real browser against a running app).

```
              ┌─────────────────────────────────────────────── REAL
   e2e        │ real browser (Chromium) + running dev server + window.__app__
              │ "does it work as a user sees it?"  · opt-in, complex/UI tasks
──────────────┼─────────────────────────────────────────────── SIMULATED
  integration │ several pieces wired through a PORT against in-memory fakes:
   (simulated)│  • use case  — makeXUseCases(deps(inMemoryRepo())): use case + fake repo
              │  • contract  — an adapter satisfies its port (in-memory/fake backend)
              │  • component — a screen vs mock use cases (UI→Store→Controller→use case)
              │  • api route — a procedure end-to-end via in-memory app.request(...)
              │ "do the seams fit?" — the bulk of the suite
   unit       │ ONE pure unit, ZERO ports/adapters — a domain rule in isolation
              │ entities, value objects, pure domain services · clock/ids are params
              └───────────────────────────────────────────────
```

| Level           | Real/simulated | What it wires                                   | Where it lives                                                                                                                                     | Question                       |
| --------------- | -------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **unit**        | simulated      | one pure unit, **no ports/adapters**            | any pure function with no ports — mostly `domain` (entities, value objects, services), plus pure `shared`/`api` helpers (e.g. `statusForErrorTag`) | a pure rule holds in isolation |
| **integration** | simulated      | several units **through a port, against fakes** | `application` use-case specs, adapter contract tests, screen tests, api route tests                                                                | the seams fit, against fakes   |
| **e2e**         | **real**       | a real browser + running app                    | `e2e/*.spec.ts` + `window.__app__` bridge                                                                                                          | it works as a user sees it     |

> **Why use cases are `integration`, not `unit`:** a use-case spec wires
> `makeItemUseCases(deps(inMemoryRepo()))` — a use case _through its port_ against
> an in-memory fake. That is integration (sociable), even though it's pure and
> fast. A genuine unit here touches no port: a domain entity or value object. (We
> don't classify by speed or by `environment`; we classify by what's wired.)
>
> In practice this repo crosses **no real boundary below e2e** — even the
> "integration" tests use in-memory fakes — so really there are **two tiers that
> run**: _simulated_ (all of vitest) and _real_ (e2e). The unit↔integration split
> is a secondary distinction _within_ the simulated tier.

Most work lives in the **simulated** tier (fast, deterministic, where TDD lives).
The **real e2e top is opt-in** and only for tasks that change user-observable
behavior: drive it as a user and assert on internal state via the runtime bridge
(`window.__app__`). See the **verify-runtime** skill.

**Which sensor runs which level:** the **`quality`** gate runs `unit` +
`integration` (vitest, simulated — this is what the Stop hook enforces); the
separate **`e2e`** sensor runs the real-browser level (Playwright, on-demand —
never in the gate). They are deliberately different sensors because one is cheap
and always-on, the other is heavy and opt-in.

### When does e2e earn its cost? (don't pay it by default)

e2e is expensive (boots a browser + a real app), so it is **opt-in, never the
gate**. The rule for spending it is mechanical:

> **A gap is _e2e-irreducible_ iff reproducing it needs something REAL that the
> simulated tier replaces with a fake.** Enumerate what the simulated tier fakes,
> and you have the exact (small) set of bugs only e2e can see.

| The simulated tier fakes…                                                                      | A bug that lives there…                            | Caught cheapest by                                                     |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| the browser engine (jsdom/happy-dom: no layout, no CSS, no real DOM)                           | layout hides a control, real event semantics       | **e2e** (rare — usually not worth it)                                  |
| the real adapters (Dexie/IndexedDB, REST/`fetch`, native SDK)                                  | bad query, serialization, error mapping            | **contract test** vs the real adapter (`fake-indexeddb`) — _not_ e2e   |
| the composition root (tests inject DI mocks, never boot `apps/*/composition-root.ts`)          | wrong adapter wired, env misread, missing provider | a **Node smoke test** that constructs the composition root — _not_ e2e |
| the router / app-shell / lazy chunks / `import.meta.env` guards                                | broken route, chunk fails to load, build guard     | **e2e** (needs a real build + serve)                                   |
| the network between frontend and backend (api tested in-memory; UI vs mocks — they never meet) | the live frontend↔backend contract is broken       | **e2e** (the only place the two real processes meet)                   |

**Everything else — `domain` rules, use-case orchestration, ViewModel
derivation, component behavior — is already covered by the simulated tier.
Requiring e2e there is pure waste.**

**Push the gap down to the cheapest level that can _see_ the faked seam.** Most
"faked seam" gaps are closed without a browser: an adapter bug → a contract test;
a wiring bug → a composition-root smoke test in Node. That shrinks e2e's
irreducible niche to three things: **the real router/app-shell/bundling, the
real frontend↔backend seam driven as a user, and real-engine interaction bugs.**
Few e2e, each high-value.

Worked examples (which level catches which bug):

| Bug                                                              | Lives in              | Caught by                                        |
| ---------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| `createItem` accepts an empty name                               | `domain` rule         | **unit**                                         |
| a blocked member still sees the admin button                     | capabilities + screen | **integration** (component vs mock use cases)    |
| the Dexie adapter drops the `archived` flag on read              | real adapter          | **contract test** (real adapter, fake IndexedDB) |
| the web app wires REST but forgets the token provider → all anon | composition root      | **Node smoke test** of `composition-root.ts`     |
| after login the router doesn't redirect to `/home`               | real router/app-shell | **e2e only**                                     |
| login passes in tests but the real `fetch` drops the auth header | front↔back network    | **e2e only**                                     |

So the default answer to "should this change get an e2e?" is **no** — unless the
diff touches a faked seam (a composition root, the router/app-shell, a real
adapter feeding a user flow, or the live auth/network seam). A change confined to
`domain`/`application`/pure UI needs none.

#### Current e2e coverage (be honest)

The e2e _machinery_ is wired (Playwright + Chromium, the `window.__app__` bridge,
the `e2e`/`e2e-auth`/`runtime-advice` sensors), but coverage is **deliberately
sparse** — don't assume a flow has an e2e just because the rail exists.

| Flow                                | e2e today | Sensor / how                                                                             |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Item CRUD on `/` (create → archive) | ✅ yes    | `e2e` — runs against `pnpm web` alone (real composition root + Dexie/IndexedDB + router) |
| Login / auth on `/login` (web)      | ✅ yes    | `e2e-auth` — boots local Supabase + API + web; global-setup seeds the bootstrap owner    |
| Staff dashboard sign-in (`:4201`)   | ✅ yes    | `e2e-auth` — owner@local.dev passes `RequireAdmin`, the directory loads                  |
| Customer onboarding (`:4202`)       | ✅ yes    | `e2e-auth` — a fresh sign-up has no org → create-organization → home                     |

Two configs, two sensors: **`e2e`** (`playwright.config.ts`) is web-only and
cheap — for flows that need no backend; **`e2e-auth`**
(`playwright.auth.config.ts`) is the suite that drives the real backend, so it is
heavy and Docker-dependent (it `supabase start`s the local stack and boots the
API + all three apps — web, dashboard, client). They are split on purpose: the
cheap web e2e must not pay for Docker. The API's CORS allowlist must include each
app's port (4200/4201/4202) — the auth config sets `CORS_ORIGINS` accordingly.
(This stack is the EXISTING giro's; a new giro brings its own auth config +
suite — ADR-0017.)

See [sensors.md](sensors.md) and [workflow.md](workflow.md).
