# ADR-0015: Shareable auth — shared identity, per-app embedded authorization

- Status: Accepted (decided 2026-06-24; phased implementation underway —
  Fase 0a done and green)
- Date: 2026-06-24
- Builds on: [ADR-0008](0008-provider-agnostic-auth-and-api.md) (provider-agnostic
  auth; token proves identity only), [ADR-0010](0010-authorization-permissions-and-grants.md)
  (permissions + temporary grants), [ADR-0014](0014-access-model-final-shape.md)
  (roles-only access model), [ADR-0009](0009-nx-monorepo-boundaries.md) (monorepo
  boundaries).

## Context

The access model (ADR-0010..0014) is to be **reused across several future apps of
different business (giro)** — e.g. a pharmacy POS + inventory app — not just
bison-manager. The requirements gathered with the product owner:

- The **same human** may be a user of more than one app (one login), but a user
  of only app A must **not** be able to enter app B.
- Each app's **roles are independent** (a giro defines its own vocabulary).
- **Auth data must not be mixed** with each app's business data.
- The cost of carrying the model into a new project should be **near-zero**.

Two truths in the existing model make this cheap rather than a rewrite:

- **Identity ≠ authorization is already physical.** `memberships.user_id`
  references `auth.users` (Supabase Auth): identity lives outside the app, the
  app only references it. All authorization (`accounts`, `memberships`, roles,
  `sessions`, `access_grants`, `audit_events`) hangs off the membership.
- **The token never authorizes** (ADR-0008): authorization is resolved fresh
  per request from the app's own data, so entry is gated by data the app owns,
  not by the token.

## Decision

**Architecture: shared identity, per-app embedded authorization.**

### 1. One shared identity provider; authorization embedded per app

- A **single shared identity provider** (one Supabase Auth project / one
  `auth.users`) is the only shared component: same human → same `user_id` → SSO.
- **Each app embeds its own authorization** in its **own database**. Entry to an
  app requires a **membership in that app's data**; with no membership the actor
  reader resolves nothing (`findActorBySession` → `null`) and the policy is
  fail-closed. So a user of only app A authenticates but cannot enter app B; a
  user of both has two **independent** memberships (independent roles, sessions,
  block/disable). Roles differ per app by construction (separate data).

### 2. Root is per-app, identity may be shared

- `is_root` is a column on `memberships` — root is an **authorization** fact,
  per app, bootstrapped by env per deployment; it does **not** propagate. The
  same identity may be bootstrapped as root in several apps (one login, root in
  each), or distinct identities may be used per app to isolate blast radius.
- The cross-app "switch" is an **SSO navigation launcher** (one login → jump to
  each app's own dashboard), **never** a data toggle inside one dashboard
  (that would require a centralized authorization plane — rejected below).

### 3. Authorization in its own schema, same DB as business

- Each app keeps authorization in a dedicated **`access` schema**, separate from
  the business schema, **in the same database** — preserving cross-schema
  foreign keys, transactions, and RLS that references `memberships`/`accounts`.
- A separate **physical** DB for authorization is a later **scaling lever**, not
  a default: moving the `access` schema out is a contained migration when a real
  signal appears. Only **identity** is centralized.

### 4. Per-app vocabulary, generic core

- The app-specific **vocabulary** — the catalog of actions, the grant-only set,
  the customer-delegable subset, the administrative presets, and the default
  role templates — is **injected as data** (`AccessConfig`), not hardcoded.
- The core is **generic over the action union and preset names**
  (`AccessConfig<Action, Preset>`, defaulting to bison-manager's types), so each
  app keeps its **own compile-time-checked** vocabulary while the policy
  mechanics (evaluate, scopes, expand, anti-orphan, grants, session policy) are
  reused **verbatim**.

### 5. Distribution: one monorepo, multiple apps

- The auth libraries stay in this **Nx monorepo** and are reused by **project
  reference**; a second app is added as `apps/app-b` with its own composition
  root, its own `AccessConfig`, and its own DB pointing at the shared identity
  provider. **No publishing.** Separate repos + publishable packages are reserved
  for the case a giro must live in its own repository.

### Rejected alternatives

- **Multi-app via an `app_id` column in one shared DB** — a permanent cross-app
  isolation tax on every query; a missed filter is a data leak.
- **A separate physical DB for authorization, pre-emptively** — loses
  cross-boundary FK, transactions and RLS-on-business-tables for no present
  benefit (an app's `public` holds only auth tables until business tables exist);
  a schema separation achieves "don't mix" with the escape hatch intact.
- **Auth-as-a-service for _authorization_** — couples availability (auth down =
  all apps down) and adds per-request latency. Only identity is centralized, and
  it is consulted at login, not per request (the token is verified locally).
- **Publishable packages now** — overhead not justified for a few apps that can
  share source in one monorepo.

## Consequences

- The same human spans apps with **independent** authorization per app, gated by
  an explicit per-app membership (the existing invitation/onboarding flow).
- **Physical data isolation** per app (separate deployments + DBs); a bug in one
  app cannot reach another app's data.
- **Reuse is near-zero-cost**: a new app = composition root + its `AccessConfig`
  - its DB (`access` + business schema) → the shared identity provider.
- **One shared kill-switch** (disabling the identity stops login everywhere);
  per-app `account.disable` and soft-block stay independent.
- Cost: making the vocabulary injectable (Fase 0b) **downgrades the closed
  `AccessAction` union in the shared core to a catalog-validated string** —
  mitigated by each app re-narrowing with its own literal union via the generics.

## Implementation plan (phased — each phase green at its tip)

0. **Vocabulary injectable** (`AccessConfig`): (a) the contract + bison-manager's
   `defaultAccessConfig` + `makeAccessVocabulary`, generic over action/preset
   (additive, behaviour-preserving); (b) thread the config through
   `evaluateAccessPolicy` / `makeAccessAction` / preset consumers and remove the
   global constants — the invasive core change.
1. **Package** the access slice (`access-core`/`adapters`/`ui`) with a clean
   public surface, consumed by project reference (monorepo, multi-app).
2. **`access` schema**: move authorization tables to a dedicated schema, RLS
   intact (same DB) — applied as the convention in the app template.
3. **Shared identity**: extract identity to a shared Supabase Auth project; the
   actor reader resolves from the local `access` data using the token's `user_id`.
4. **App B is born**: `apps/app-b` (composition root + its `AccessConfig` + its
   DB → the shared IdP); per-app onboarding governs entry.
5. **(optional) Generator** `nx g access-app`: scaffold a new app already wired.

## Status of the plan (2026-06-24)

- **Fase 0a done and green** (uncommitted): the `AccessConfig<Action, Preset>`
  contract + `defaultAccessConfig` + `makeAccessVocabulary` in
  `libs/domain/src/access/config/config.ts`, generalized to multi-vocabulary,
  with a conformance spec. **Seam validated against a second consumer**: a
  pharmacy-POS placeholder `AccessConfig` (its own actions, `controlled.dispense`
  as the grant-only action — mirroring `customer.read` — and `vendedor`/
  `administrador` org presets) runs through the same `makeAccessVocabulary`,
  proving the catalogs are independent. domain 9/9, structure ok, gate ok.
- **Fase 0b deferred** until app B is concrete enough to scaffold (`apps/app-b`),
  so the invasive core migration is validated against the real second consumer
  (not only the placeholder) — the "no abstraction before the second use" rule.
- **Fase 2** has near-zero value as a retrofit today (bison-manager's `public`
  holds only auth tables — separating from nothing); it lands as the app-template
  convention at Fase 4. It also requires local Supabase (Docker) to verify.
