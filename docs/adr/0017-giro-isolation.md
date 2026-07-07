# ADR-0017: Business verticals (giros) are fully isolated — A never knows B exists

- Status: Accepted
- Date: 2026-07-05
- Builds on: [ADR-0015](0015-shareable-auth-shared-identity-embedded-authz.md)
  (shared identity applies WITHIN a giro's apps, and its injectable access
  vocabulary is what makes per-giro worlds cheap),
  [ADR-0005](0005-composition-roots-no-container.md) (connections are wired in
  exactly one place per app), [ADR-0008](0008-provider-agnostic-auth-and-api.md)
  (the auth provider is a port), and [ADR-0016](0016-plans-subscriptions-entitlements.md)
  (the billing engine is a shared library; plan catalogs are per-giro DATA).

## Context

The monorepo ships **products/giros** — distinct businesses (Medicine Manager
today; others later), each with its own dashboard + N apps. The question:
when real databases arrive, do giros share infrastructure — one DB, one
identity pool, one API — or is each giro its own world?

Users of two different businesses do not meaningfully overlap; there is no
product reason for a login that crosses giros. Sharing runtime infrastructure
between them would buy nothing and cost coupling: cross-business incident
blast radius, entangled compliance/data-ownership, and surgery the day a giro
is sold or shut down.

## Decision

**Two levels, opposite policies:**

1. **Between giros: TOTAL runtime separation.** Each giro owns its auth
   project (its own user pool), its database, its API deployment, its
   migrations history, its access vocabulary, its plan catalog and billing
   data, its secrets. Nothing at runtime is shared; giro A cannot reference
   giro B in any way. No global SSO.
2. **Within a giro: ADR-0015 as designed.** The giro's dashboard and its N
   apps share ONE identity pool (log in once, enter any app of that giro);
   authorization stays embedded per app, computed fresh per request.
3. **Code is shared at COMPILE time only.** The monorepo libs (domain,
   application, infrastructure, the design system, the harness) are consumed
   like npm libraries: each giro instantiates its own world from them
   (`apps/app-b` is the living template — its own `AccessConfig`, its own
   vocabulary). A fix to the shared billing/access engines reaches every giro
   via that giro's own redeploy. Reuse is not runtime coupling; duplicating
   the code would be the real mistake (every bug paid N times).

**Standing up a new giro** (the recipe — no changes to existing code):

1. New auth+DB project (e.g. a fresh Supabase project).
2. New thin API app with its composition root pointing at that project.
3. Its own access vocabulary (`AccessConfig`) and role/plan seeds.
4. Its own migrations directory (today's `supabase/` belongs to the existing
   platform; future giros get their own — no move needed now).
5. Its UIs under `libs/ui/src/<giro>/…` (per the screens organization).

## Signed trade-offs (owner, 2026-07-05)

- **No global SSO across giros** — a person with accounts in two giros has
  two logins, and the owner/staff holds one staff account per giro. Deliberate:
  retrofitting a federated IdP later is the one burned bridge, accepted
  because distinct B2B verticals will almost surely never want it.
- **N giros = N operational instances** — N auth projects/bills, N secret
  sets, N migration histories, N deploys. Trivial at 2; automate when many.

## Guardrails

- Nothing giro-specific may enter the shared libs — giro-specific code lives
  in `apps/*` and `libs/ui/src/<giro>/`. The layer-boundary lint fails
  cross-PROJECT violations (an app importing another app); imports BETWEEN
  giro dirs inside `libs/ui/src` are NOT yet lint-enforced (`libs/ui` is one
  Nx project) — add a `no-restricted-imports` stanza per giro dir (the
  eslint config already uses that pattern) the day a second giro dir exists.
  Until then, review guards naming/content drift.
- Per-giro data (orgs, memberships, roles, plans, subscriptions) never gains
  a cross-giro discriminator column; separation is by project/schema, never
  by `giro_id` in shared tables.

## Consequences

- Incidents, compliance scopes, backups and data ownership are per-business;
  selling or sunsetting a giro is `terraform destroy`-shaped, not surgery.
- A giro can later move from "own schema" to "own cluster" (or its own cloud
  account) by changing connection strings in ONE composition root.
- The cost of isolation is operational plurality, paid only when a giro
  actually exists — standing this up today costs nothing because only one
  giro exists and the seams (ADR-0005/0008/0015) are already in place.
