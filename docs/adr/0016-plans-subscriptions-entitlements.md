# ADR-0016: Plans, subscriptions & entitlements — billing as its own bounded context

- Status: Accepted (design approved 2026-07-03; not yet implemented)
- Date: 2026-07-03
- Builds on: [ADR-0010](0010-authorization-permissions-and-grants.md),
  [ADR-0011](0011-dynamic-roles-and-ownership-flags.md),
  [ADR-0014](0014-access-model-final-shape.md) (the access-model idioms it
  mirrors), [ADR-0015](0015-shareable-auth-shared-identity-embedded-authz.md)
  (whose shared policy core it must NOT touch), and
  [ADR-0008](0008-provider-agnostic-auth-and-api.md) (the provider-agnostic
  seam it repeats for payments).

## Context

The product needs **plans**: a Free plan (own at most 1 org, max 3 members per
org, premium features off, free for a per-plan trial window — initially 3
months — then paid at a price not yet decided), plus the ability to **add,
edit, hide and custom-build plans at will** from the admin. The owner's
operating playbook is explicitly Stripe-like, run by hand: edit plans live and
communicate; when a customer is hurt by a change, create a hidden "legacy" plan
with the old terms (or a per-org exception) and assign it. Payments do not
exist yet; staff manual levers are the bridge.

The owner's open question was whether to reuse the permissions/roles machinery.
No billing/plan/subscription concept exists anywhere in the codebase today; the
only related artifact is a **UI-only** "you may own one org" hint in the
org-switcher prototype (never enforced server-side).

The design was stress-tested adversarially (concurrency, commercial lifecycle,
abuse/architecture — 24 scenarios); the decisions below incorporate what
survived.

## Decision

### 1 — Mirror the access-model _pattern_, not its machinery

Plans/entitlements are a **new bounded context (`billing`)**, separate from
authorization, because they answer a different question:

- **Different subject**: a permission is a per-ACTOR boolean ("may this
  membership do X?"); an entitlement is a per-ACCOUNT quantitative/temporal
  question ("may this org grow to N+1 / use feature F, given what it pays?").
  `evaluateAccessPolicy` is deliberately pure over the actor — no counts, no
  usage, no commercial time windows.
- **Different denial**: `app/access-denied` (403, "you may not") vs "your org's
  plan doesn't cover this" (upsell UX, distinct tags/status — see Decision 5).
- **Opposite volatility**: pinning permissions was the bug ADR-0011 killed
  (live reference always); pinning commercial terms (grandfathering) is a
  _feature_, handled operationally (Decision 3).

What IS reused, one-for-one: the data-driven staff-editable catalog with a code
floor (`DEFAULT_PLANS` ≈ `ROLE_TEMPLATES`), blocked-in-use delete (retire, never
delete), pure decision functions (denial is a decision, not a thrown error),
audit-atomic writes, `Clock`/ids injection, `Result` idiom, in-memory≡Postgres
contract tests, and the slice shape (`ports.ts`/`errors.ts`/`use-cases.ts`).

The only touchpoints with the access model are **additive**: two new actions in
`ACCESS_ACTIONS` — `plans.manage` (staff `any`; **owner preset only** in v1)
and `billing.read` (customer `own`, delegable; staff presets hold it at `any`,
so support can read an org's billing without managing the catalog) — because
_administering the catalog_ is an authorization question even though _being
entitled_ is not.

### 2 — The model: catalog of facts, derived state

**`Plan`** (staff-editable row): stable `key` + customer-facing `displayName`
(customers never see `key` — a "Pro Legacy" org just sees "Pro"), required
`internalNote` (why this plan exists, for whom), `status: active | retired`,
`visibility: public | hidden` (orthogonal: hidden+active = staff-assignable
only — the home of legacy/custom plans; retired = frozen, closed to ALL new
subscriptions, even staff), entitlements, `trialMonths`, `price` (nullable —
"not decided yet" is first-class), and a singular **`defaultForNewOrgs`**
marker with write guards (the default plan cannot be retired/hidden; changing
the default requires pointing at an active plan first, audited as
`billing.default-plan-changed`). DB: `unique(key)`, idempotent seed
(`on conflict do nothing`).

**Entitlements are named and closed, not a generic engine**:
`limits: { maxOrganizationsOwned, maxMembersPerOrg }` (null = unlimited) +
`features: PlanFeature[]` — a closed union like `ACCESS_ACTIONS`,
deny-by-default. A limit without a code enforcement point is dead config, so
the vocabulary is the contract: creating a plan combines existing capabilities;
it cannot invent functionality.

**`Subscription`** (one per customer account; staff accounts have none and are
exempt): stores **facts only** — `accountId` (`unique`), `planId` (live
reference; FK `on delete restrict`), `createdByUserId`, `startedAt`,
`trialEndsAt` (**frozen at subscribe** = `startedAt + plan.trialMonths`),
`paidThroughAt`, `canceledAt`, and `overrides: Partial<PlanEntitlements>` —
the per-org exception valve (the personal-role analog): "you keep 25 seats" is
one override on that org, not a new plan. Phase is **derived, never stored**,
by a pure function over facts + injected clock, using **Stripe's vocabulary**
(`trialing | active | past_due | canceled`); expiry is observed lazily, with an
optional sweep backstop (the `grant.expired` precedent — which is lazy
recording _plus_ a pg_cron backstop; correctness never depends on the cron).
Before copying that lazy-recording code, verify the existing `grant.expired`
write is CAS-guarded (see Decision 5's one-event rule).

**Birth is atomic**: org + owner membership + subscription are committed in one
adapter transaction. An org with no subscription (crash, seed mistake) is
**fail-closed for growth**: deny limit-gated mutations, allow reads, emit a
staff-visible audit anomaly — never "no subscription = unlimited".

### 3 — Live propagation, with instruments (the owner's D3)

Editing a plan's **limits/features propagates live** to every subscriber (the
roles' live-reference semantics; the owner handles customer comms). This is
only operable with four instruments, which are **hard preconditions**:

1. `plan.updated`/`plan.reset` audit events carry **full before+after
   payloads** and a **mandatory `reason`** — without them the legacy playbook
   cannot reconstruct the old terms (they exist nowhere else), and staff-lever
   misuse is invisible.
2. **Blast-radius preview + confirm** on `plans.update` AND `plans.reset`
   (subscriber count; how many orgs would go over-limit / lose a feature /
   would-expire) — the ADR-0014 "apply to all" UX verbatim. `reset` restores
   the code floor and is a mass live-edit in disguise; it gets the same gate.
3. A `plans.subscribers(planId)` staff query (org, since-when) — the minimum
   instrument for edits, appeasement and cleanup.
4. **Optimistic concurrency** on `plans.update` (`expectedVersion` check ⇒
   `app/plan-concurrently-modified`) — two staff editing the same plan must
   not silently lose an update on the highest-blast-radius row in the system.

**The trial window is the one thing that does NOT propagate**: `trialEndsAt`
is a frozen fact; `trialMonths` governs new subscriptions; existing orgs are
adjusted per-org via `extendTrial`. Deriving trials live would make "shorten
the trial" a retroactive fleet-wide kill switch.

**Plan changes never grant a fresh trial**: the trial is a **once-ever
per-account budget** anchored at first subscribe (`applyPlanChange` pure
function, spec'd) — otherwise staff favors instantly expire orgs mid-trial and
self-serve plan ping-pong becomes unlimited free service. A new trial only via
explicit, audited `extendTrial`. Additionally, **one trial per creating
identity**: an identity's second org is born with its trial already consumed
(`trialEndsAt = startedAt`) — closes rolling-trial farming by the same user.

### 4 — Enforcement: growth-only, transactional, declarative

Limits gate **growth mutations only** — never evict, never auto-repair, never
block existing operation. Over-limit state (5/3 members after a downgrade) is
representable, visible and legal.

- **Org creation** (`libs/application/src/identity/create-organization.ts`,
  pre-actor): check `maxOrganizationsOwned` counting orgs the identity **owns**
  (`isAccountOwner`) **on the plan the new org would be born on** (per-plan
  counting — so a custom multi-org deal on another plan doesn't consume Free
  slots), under a per-user advisory lock (the count-of-rows-not-yet-existing
  race is the one case `select … for update` cannot cover); then create the
  subscription in the same transaction. The route also gains a trivial
  per-identity/IP throttle (it is pre-actor and fans out heavy writes). Noted
  deliberately: this makes the ownership limit accidentally load-bearing for
  abuse control on the one unauthenticated-adjacent write path.
- **Invitations do not reserve seats** (owner's D1). Corollaries, all part of
  the decision: `makeCreateInvitation` shows a soft warning (not a check) when
  the org is at capacity; the seat limit is enforced **transactionally at
  membership attach** (first login), reusing the anti-orphan
  `select … for update` pattern inside `acceptInvitation`; therefore **an
  invite can bounce at activation** ("org is full") — the bounce is an explicit
  contract: surfaced at login, the invitation visibly marked seat-blocked for
  the inviting admin, and no silent auto-attach on a later login once the user
  holds any other membership. Accept is idempotent
  (`on conflict do nothing` + CAS consume `where accepted_at is null`).
- **Premium features**: checked server-side in the use case **after**
  `authorizeAccessAction` (authz 403 always wins first), plus a **declarative
  `feature?: PlanFeature` field on `ApiProcedure`** enforced centrally in the
  rpc pipeline — a forgotten server-side gate becomes unrepresentable. This is
  a **new** pipeline behavior, not a mirror of `action`: today `action` is
  declarative metadata that enforcement never reads (each use case
  self-authorizes, because a registry-level check cannot see scopes or
  grants). A feature check needs no resource or scope — the actor's account +
  its plan suffice — which is exactly why central enforcement is sound for
  `feature` and not for `action`. UI receives capability flags via flows and
  never authorizes.

### 5 — Trial expiry is a billing-phase gate, NOT `access.block`

The owner's intent (an expired, unpaid org cannot operate) is honored inside
the **entitlement guard**, not the access layer: phase `past_due` ⇒ deny all
limit-gated mutations and all `feature.*`, and (full-stop variant) a
pipeline-level billing hold, scoped to the delinquent account, denying every
procedure **except `billing.read`**, future payment actions, and the
structural self-service procedures (`action: null` — `memberships.mine`,
`session.switch-account`, the access self-query), so a multi-org user can
still switch to a healthy org — with a distinct tag. (Vocabulary, defined
once: prose "expired" = phase `past_due`; the customer-facing tag
`app/subscription-expired` names the hold in both `past_due` and `canceled`
phases.) Rationale: the existing
soft-block denies _everything_ including the customer's own billing screen and
any future pay button — a dead end at the exact conversion moment — and fixing
that inside `evaluateAccessPolicy` would contaminate the ADR-0015 shared core.
`access.block` remains what it is: a manual staff escalation lever. Derived
denial also un-blocks instantly on `markPaid`/`extendTrial`/plan change — no
stale block boolean, no reconciliation.

**Blocking eligibility requires a price**: an org cannot be delinquent on a
plan that had no price while it expired. Enforcement activates only when
`plan.price != null` and a grace window anchored at **when the price was set**
has elapsed — otherwise the pricing launch would mass-lock the backlog of
unpriced-era expirees on day one.

**Staff levers** (`markPaid`, `extendTrial`, `changePlan`, `setOverride`):
**absolute setters** ("paid through DATE", "trial ends DATE" — idempotent
under retries), with a **mandatory `reason`** (the impersonation-grant
precedent). During the manual-billing era the audit trail IS the accounting;
the day-1 event set is non-negotiable: `plan.created/updated/retired/reset`
(with payloads), `billing.default-plan-changed`, and `subscription.started/
plan-changed/paid-marked/trial-extended/trial-expired/override-set` —
`paid-marked` additionally records an optional amount/currency note (the only
manual-era answer to "what did we collect this month?"), and all
lazily-recorded transitions are CAS-guarded so concurrent observers emit one
event, not N.

**Error vocabulary**: `app/plan-limit-exceeded` → 409,
`app/subscription-expired` → 402; **403 stays reserved for authorization
denials** (today `app/access-denied` and `app/impersonation-grant-not-owned`)
— billing denials never masquerade as 403. Billing use cases follow parse →
authorize → load, and every procedure gets a uniform-denial contract test
(foreign `accountId` ⇒ generic `app/access-denied` — the `guardRootTarget`
anti-enumeration philosophy). `plans.list` is gated by `plans.manage`
(owner-only in v1): hidden plan names encode who got special terms.

## Rejected alternatives

- **Features through roles/templates.** The killer scenario: if "Pro grants
  `reports.advanced`" via a template, a customer-authored role holding that
  action survives a downgrade untouched (template propagation only touches
  synced instances) — premium forever, the sticky-permission bug of ADR-0011
  resurrected across two systems. The vocabularies stay disjoint (a spec
  asserts `PLAN_FEATURES ∩ ACCESS_ACTIONS = ∅`): roles say _who inside the
  org_; the plan says _what the org bought_; a use case checks both, authz
  first.
- **Plan versioning / pinned subscriptions.** Grandfathering-by-construction
  (immutable `PlanVersion`, subscriptions pin a version) was designed and
  rejected for v1: the owner explicitly wants live propagation + operational
  grandfathering (hidden legacy plans, per-org overrides) — Stripe's
  archive-the-Price model run by hand. Before+after audit payloads are the
  cheap substitute that keeps old terms reconstructable. Versioning remains an
  additive later step if edit volume outgrows the playbook.
- **`access.block` as the trial-expiry mechanism.** See Decision 5.
- **A generic entitlement engine** (limits as `Record<string, number>`, rule
  DSL). Two named limits + a closed feature union are the entire requirement;
  a new limit is a new field, compile-time visible at every check site.
- **An identity-level subscription** for "max 1 org". The subscription belongs
  to the org (what is billed, blocked, seat-limited, what Stripe's
  Customer/Subscription maps to); the ownership limit is evaluated at
  create-org against the creating identity's owned orgs, per-plan.
- **Seat-reserving invitations** — rejected by the owner (D1); the
  attach-time transactional check is the compensating control.

## Accepted trade-offs (signed off by the owner, 2026-07-03)

1. **Sibling-org seat evasion**: member #4 can create their own Free org and
   invite everyone. Accepted — seat limits monetize only when the org's _data_
   is the moat; splitting orgs is its own pain. Do not "fix" by counting
   memberships (that would break the invited-is-free virality).
2. **Multi-email trial farming** is only _detectable_ (per-identity rule +
   `createdByUserId` audit + staff overlap metrics), not cheaply preventable.
3. **Invites can bounce at activation** — the direct consequence of D1.

## Consequences

- Monetization limits become enforceable server-side (today the only "limit"
  is a fake UI flag), with upsell-grade errors distinct from authorization.
- The catalog is fully owner-operable (create/edit/hide/custom/assign) with
  the blast radius made visible instead of silent; the escape hatches (hidden
  legacy plans, per-org overrides) are first-class.
- Payments later are an adapter, not a redesign: Stripe-shaped phases and
  facts (`paidThroughAt`/`canceledAt` are what webhooks write), `Plan.key` ↔
  Product, price on the plan; the `PaymentGateway` port stays undefined until
  needed (ADR-0008 precedent). Not built now: checkout, invoices, proration,
  dunning, self-serve plan changes, metering.
- Cost: two new slices (`billing-plans`, `billing-subscriptions` + domain
  `billing/`), three touched use-cases (create-org, create-invitation,
  invitation-attach), one rpc-pipeline extension (`feature`), and the audit
  union growth. The shared access core is untouched.

## Owner decisions record (2026-07-03)

- **D1** — pending invitations do NOT consume seats (with the bounce contract
  and attach-time transactional check above).
- **D2** — `maxOrganizationsOwned` counts orgs the identity OWNS, per-plan.
- **D3** — plan edits propagate live to all subscribers (owner communicates);
  the trial window alone is frozen per-subscription.
- **D4** — trial reached without payment ⇒ org cannot operate, via the
  billing-phase gate (price-set + grace precondition); trial length is
  per-plan data, any plan may carry one.
- **D5** — existing data is disposable; no backfill/migration constraints
  (until the first `markPaid` — that row is a commercial commitment).
- **D6** — free-form catalog: create/edit at will, hidden plans, custom
  per-client plans, staff-only `changePlan` in v1.
