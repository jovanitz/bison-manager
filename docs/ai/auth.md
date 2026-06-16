# AI context — Authentication & Access (how THIS app works)

> Audience: an AI agent in a **cold session**. This is the reference for how
> identity, sessions and authorization actually work in Acme — the _model_, not
> the build rules. For build rules of sensitive code read [security.md](security.md).
> For the live per-action/preset matrix read the **generated**
> [../business-rules/access.md](../business-rules/access.md) (`pnpm harness rules`).

## The one idea that explains everything: **identity ≠ authorization**

- **Identity** = "who are you". Proven by a JWT from Supabase/GoTrue. The token
  carries only identity claims (`sub` = userId, `session_id`, `email`, `aud`).
  The token never carries roles or permissions.
- **Authorization** = "what may you do _here, now_". Computed **server-side per
  request** from current DB rows — never from the token. The unit of
  authorization is the **actor** (a membership), not the identity.

A valid token gets you a resolved actor; it does **not** get you any permission.

## The actor (resolved fresh on every request)

`AccessActorReader.findActorBySession(sessionId)` resolves, with one join over
**current** rows, an `AccessActor`:

- `membership { id, userId, accountId }` — the identity's seat in ONE account.
- `accountStatus` (active | disabled), `accountKind` (staff | customer).
- `isRoot` — the protected super-admin membership.
- `blocked` — soft-blocked (see below).
- `session { id, status, expiresAt, createdAt }`.
- `permissions` (the stored list) + `grants` (active impersonation grants).

Because it reads live rows, a disable / revoke / permission-change / block is
visible on the **very next request** (revocation immediacy). Adapters:
[postgres actor-reader](../../libs/infrastructure/src/access/postgres/actor-reader.ts)
and the in-memory twin must honour this identically (same contract test).

## The request pipeline (apps/api, Hono)

Every capability is **one `ApiProcedure`** — name + Zod schema + required
`action` + use-case handler — declared in
[apps/api/src/procedures](../../apps/api/src/procedures). Routes are generated:
`POST /rpc/<name>`. The order is the whole security story:

1. **actor middleware** — resolve the actor from the bearer token. No/!valid →
   **401, fail-closed**. ([actor middleware], 401 before anything else.)
2. **Zod parse** the body → 400 on bad input (validate at the boundary).
3. **handler** calls the use case, which **authorizes** (`authorizeAccessAction`)
   then acts and returns a `Result`.
4. `Result` tag → HTTP status via `statusForErrorTag` (`app/access-denied` → 403,
   `app/*-not-found` → 404, etc.).

**Public routes are mounted BEFORE the actor middleware** (no token needed):
`/health`, `/invitations/activate` (the secret token IS the credential), and
`/id/create-organization` (org-less identity bootstrapping its first org — it
verifies the bearer JWT itself for identity, but needs no actor/permission).

To add an endpoint you only declare a procedure; never hand-write a route, never
put auth logic in a handler — it lives in `domain`/`application`.

## Authorization = permissions (+ grants), deny-by-default

`authorizeAccessAction({ actor, action, resource, now })`
([policy evaluate](../../libs/domain/src/access/policy/evaluate.ts)) checks, in
order and fail-closed:

1. account not `disabled`, session active/not expired;
2. `actor.blocked` → deny everything (soft block);
3. a **permission** matching `action` + scope, OR an **active grant** covering it.

- The action set is **closed**: `ACCESS_ACTIONS`
  ([value-objects](../../libs/domain/src/access/value-objects.ts)). An action not
  in the union cannot be expressed, let alone allowed.
- **Scopes:** `own` = only the actor's own account (`resource.accountId` must
  equal the actor's). `any` = staff-grade, every account.
- **Two coherence guards** (`guardGrantedPermissions`,
  [access-admin/deps](../../libs/application/src/access-admin/deps.ts)) bound a
  customer org's blast radius: a **customer-kind** account may never hold `any`
  scope, and may only hold the **delegable subset**
  (`ACCESS_CUSTOMER_DELEGABLE_ACTIONS`). Platform machinery (disable, promote,
  impersonate, settings, `access.block`) is staff-only — not even an owner can
  hand it into an org.

### Presets are NOT roles

`owner | support | customer | customer-admin`
([presets](../../libs/domain/src/access/presets.ts)) are just starting bundles an
admin applies and then edits. The policy **never** asks "is this an owner?" — it
only ever checks the stored permission list + grants.

## Multi-organization

One identity → many memberships (one per account). The session is bound to **one**
membership at a time. `memberships.mine` feeds the org switcher;
`session.switch-account` re-binds the live session to another of YOUR memberships
(structural check: it must be yours — no permission grants switching into
someone else's), recomputing expiry under the target account's session policy.

## Sessions

Session lifetime is policy-driven per account kind (staff = strict, customer =
lax), with idle + absolute caps; `settings.update` reconfigures it within hard
bounds. Switching accounts recomputes expiry (idle restarts; absolute clock stays
anchored at the original login).

## Impersonation (support reads customer data only via a grant)

`support` can `customer.search` and `impersonation.start/end`, but has **no**
`customer.read`. Reading a specific customer's data is authorized **only** by an
active, time-boxed, view-only **grant** on that account. `owner` has no
impersonation at all.

## Invitations → activation → join

1. An admin issues `members.invite` (own scope for an org admin; any for staff):
   creates an invitation with a **one-time token** — only its **hash** is stored.
2. The invitee opens the link and `POST /invitations/activate` (public): sets a
   password; the identity is provisioned.
3. On first login the invitation is consumed and the membership attaches to the
   inviting account (the invitation **wins** over creating a fresh personal org;
   no duplicate account).

## Onboarding (Approach A — org-less by default)

Signup creates an **org-less identity**: no membership, no session
([identity/provisioning](../../libs/application/src/identity/provisioning.ts) →
`provisionMembership` returns `null` for non-bootstrap users; login returns
`{ sessionId: null }`). The user then either:

- **creates their own org** via `/id/create-organization` → becomes that org's
  `customer-admin`; or
- is **invited out-of-band** by another org's admin (there is no formal
  join-request feature).

The client app's gate renders: anonymous → login; authenticated but org-less →
"create your organization"; soft-blocked → notice; else → the app
([require-session](../../libs/ui/src/client/require-session.tsx)).

## Soft block vs hard disable (two different denials)

| Mechanism        | Subject                     | Login? | Operations                | Resolution      |
| ---------------- | --------------------------- | ------ | ------------------------- | --------------- |
| **Soft block**   | org / identity / membership | ✅ yes | ❌ all denied (`blocked`) | succeeds        |
| **Hard disable** | account (`account.disable`) | ❌ no  | n/a                       | **fails → 401** |

Soft block sets `actor.blocked` (the actor reader ORs three sources: account
`blocked`, `blocked_identities`, and `memberships.blocked`). The policy then
denies every gated op while login + reading the access snapshot still work.

- `access.block` (staff, `any`) → block a whole **org** or an **identity**.
- `members.block` (org admin, **own**) → block one **member inside your org**;
  refuses your own membership (no self-lockout), the root, and cross-org targets.

## Root (super-admin) protection

The bootstrapped owner membership has `is_root = true`
(`BOOTSTRAP_OWNER_EMAIL`'s first login). `guardRootTarget` makes root **immune**
to block / remove / permission edits by anyone — and returns the **generic**
`app/access-denied` (never a distinct tag) so responses can't be used to
**enumerate** who is root.

## Audit is atomic & unavoidable

Every sensitive write takes its **audit event as a parameter** so the adapter
commits mutation + audit record in **one transaction**. An unaudited sensitive
action is unrepresentable by design ([events](../../libs/domain/src/access/events.ts)).

## Where each piece lives (read these to go deep)

- **domain** — actions/scopes ([value-objects]), presets, policy
  ([evaluate]), audit [events]. Pure, no framework.
- **application** — use cases + **port types**, by slice: `access-admin`
  (accounts/permissions/sessions), `access-members` (roster, remove, multi-org),
  `access-block` (org/identity/**membership** block), `access-invitations`,
  `access-directory`, `identity` (provisioning, create-organization),
  `access-client` (the client/dashboard gateways the UI consumes).
- **infrastructure** — Postgres + in-memory stores, the Supabase auth provider
  (JWT via JWKS), the RPC `ApiClient` gateways (bearer attached).
- **apps/api** — the procedure registry + pipeline + `composition-root.ts` (the
  only place adapters are wired).
- **libs/ui** — `dashboard/` (staff) and `client/` (customer self-serve) screens;
  authorization is server-side, the UI only **hides** what would be denied
  (`holdsAction`).

## Per-user-type capabilities (today)

Source of truth = stored permissions; this is what each **preset** grants:

- **owner / root (staff):** accounts disable/enable/promote, permissions, sessions
  read/revoke, staff directory, customer search, `access.block`, audit, settings,
  members invite/read/remove — all `any`. No `customer.read`, no impersonation.
  If root: immune to admin mutations.
- **support (staff):** `customer.search` + impersonation start/end (`any`);
  customer data only through an active grant.
- **customer-admin (org owner):** within their OWN org (`own`): invite, list,
  edit-permissions (delegable subset only), remove, **block/unblock** members,
  read audit; plus the member capabilities; can create more orgs and belong to
  several.
- **customer (member):** `customer.read`, sessions read/revoke — all `own`.
- **special states:** anonymous → login/signup only; org-less → create-org or
  await invite; soft-blocked → login but every op 403.

[actor middleware]: ../../apps/api/src/rpc
[value-objects]: ../../libs/domain/src/access/value-objects.ts
[evaluate]: ../../libs/domain/src/access/policy/evaluate.ts
[events]: ../../libs/domain/src/access/events.ts
