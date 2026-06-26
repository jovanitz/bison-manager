# ADR-0014: Access model — final shape (roles-only, template propagation, extensible scope)

- Status: Accepted (implemented 2026-06-23; roles-only end to end)
- Date: 2026-06-20
- Amends: [ADR-0011](0011-dynamic-roles-and-ownership-flags.md) (finalizes the
  "Phase 6" roles-only migration), [ADR-0013](0013-staff-editable-role-templates.md)
  (adds template propagation). Builds on [ADR-0012](0012-default-role-templates-and-reset.md).

## Context

Before building the remaining UI and the roles-only migration, the access model
was reviewed against RBAC (NIST), ABAC, ReBAC/Zanzibar, IAM and multi-tenant SaaS
patterns. Findings:

- The **core is robust** and must be **kept**: a deny-by-default, fail-closed,
  formally-verified pure policy; atomic audit; hexagonal adapters with
  in-memory≡Postgres contracts; temporary audited grants; ownership flags; the
  token never authorizes (fresh authz per request → immediate revocation).
- Three decisions are worth **locking now** so the model stays flexible without
  over-engineering. The guiding principle: **reuse the verified core; build only
  what is needed + leave clean seams** — speculative generality (groups,
  ReBAC, account hierarchy) is a liability, not robustness.

## Decision

### 1. Roles-only (finalizes ADR-0011 "Phase 6")

- Effective permissions are **only** `union(expand(roleIds))`. The transitional
  per-membership **direct permission list is removed** as a source of truth.
- A one-off grant is a **personal role**: a role owned by exactly one membership
  (its account, marked personal), holding the raw actions. There is no second
  kind of grant — everything is a role.
- **Migration** (non-destructive): every existing membership's direct
  permissions become a personal role referenced by its `roleIds`; invitations
  carry `roleIds` only (drop `permissions`); presets already live as templates
  (ADR-0012/0013).
- Revocation is clean: removing an action means editing/removing the role(s)
  that grant it — no sticky direct permission survives a role edit.

### 2. Template propagation (refines ADR-0013)

- Each org default role (a **template instance**) is **synced** (tracks the
  staff template) or **forked** (locally edited → stops auto-tracking).
- Editing an instance **forks** it. `reset` re-applies the live template and
  marks it **synced** again.
- Staff **"apply to all"**: push a template change to every **synced** instance
  (audited, blast-radius shown); **forked** instances are left alone (they pull
  changes only via an explicit reset). So a default fix reaches tenants without
  silently overwriting their customizations.
- The **code catalogue stays the floor**: an instance resets to its template; a
  template resets to its code definition.

### 3. Scope is an extensible concept (keeps `own | any`)

- `AccessScope` keeps `own | any` **behaviour**, but its type and the policy
  `evaluate` are shaped so a **third scope** (e.g. a group/resource selector) is
  **additive**, not a rewrite.
- Groups / resource-level scope are **not built** now (no product need) — only
  the seam is reserved. A formal invariant pins that `own`/`any` behaviour is
  unchanged.

### Reuse, not rewrite

The policy core, audit, contracts, grants, ownership flags and sessions are
**kept**. Only the _shape_ changes (direct permissions → roles; code template →
staff template with propagation), done in green sub-steps with a data migration
— never a from-scratch rebuild.

## Consequences

- **One source of truth** (roles) for authorization → simpler resolution, fewer
  revocation edge cases. Cost: a personal-role row per membership that holds
  one-offs.
- **Template fixes reach tenants** (synced) while customizations are preserved
  (forked) — solving the "a default fix never propagates" gap.
- **Scope can grow** (a future group/resource scope) without a rewrite; we avoid
  building speculative groups today.
- A **migration is required** (the roles-only collapse), executed in
  behaviour-preserving sub-steps.

## Implementation plan (phased — each phase green at its tip)

1. **Scope seam** (domain): make `AccessScope`/`evaluate` extensible; invariant
   that `own`/`any` are unchanged.
2. **Roles-only**: actor resolution = `expand(roleIds)` only; personal role per
   membership; migrate direct permissions → personal roles; invitations
   roleIds-only; guards/coherence operate on roles.
3. **Template store + propagation**: staff-editable templates (code = floor);
   per-instance synced/forked; `reset` (client) + "apply to all" (staff); the
   dashboard "Default templates" surface + role edit.
4. **Close gaps**: owner-block guard; seed platform defaults; client roles UI
   (invite = roles-only, manage/reset org roles); dashboard account-admin UI
   (disable/enable/promote/settings/audit views); doc-gen fixes.
5. **Verify**: formal invariants for the final model; runtime validation; the
   quality gate; a security review.

## Status of the plan (2026-06-23)

Phases **1, 3, 4, 5 are implemented and green** (scope seam; template store +
propagation; all gap-closing UI — client roles + dashboard account-admin:
lifecycle, audit, sessions, session-policy; all flows MCP-registered; formal
invariants in `access/_formal/final-model.formal.spec.ts` + a clean security
audit). **Phase 2 (roles-only) is complete** — done in green sub-steps:

- **2.0** — `Role.isPersonal` end-to-end. **Done.**
- **2.A (keystone)** — anti-orphan + coherence now count **effective** permissions
  (`direct ∪ expand(roleIds)`), so a role-granted admin governs like a direct one.
  This is what **decouples** the rest: clearing the direct slot can no longer
  silently orphan an account. **Done** (both adapters + contract; the count is in
  `postgres/admin/anti-orphan.ts` / `in-memory-membership-perms.ts`).
- **2.B** — `updatePermissions` routes one-off grants into a per-membership
  **personal role** and clears the direct slot; reads (`findMembership`,
  `listMembers`) report the one-off set (`direct ∪ personal`); `roles.list`
  excludes personal roles and `assignRoles` preserves them. Adapter-level only —
  the `AccessAdminRepository` port contract is unchanged, so application/UI are
  untouched. **Done** (both adapters + contract).
- **2.D** — data migration: existing/​seeded direct perms → personal roles.
  SQL migration `20260623130000_roles_only_personal_roles.sql` (idempotent
  DO-block, production rows) + both test seeders insert roles-only (one-off perms
  become a personal role at seed time, mirroring the migration so the contract
  runs against roles-only data) + in-memory `migrateDirectToPersonalRoles` pass.
  Behaviour-preserving (resolution still unions). **Done** (full suite green).

- **2.B′** — redirect the remaining write paths (`createOwnerMembership`
  bootstrap, `createCustomerMembership`/createOrg, `acceptInvitation`) to write a
  personal role instead of direct perms (each provisioning insert is immediately
  followed by `upsertPersonalRole`, which clears the direct slot in the same
  transaction). **No runtime path now writes a non-empty direct slot** — the
  column is empty everywhere at resolution time. Adapter-level only; the
  onboarding port contract is unchanged. **Done** (both adapters; full suite +
  api E2E bootstrap/invite/self-signup green).

- **2.C** — actor resolution is now roles-only: `resolveActorPermissions(roles)`
  dropped the `direct` parameter and is exactly `expandRoles(roles)`; the
  in-memory actor reader, the anti-orphan `effectivePermissions`, and the
  Postgres actor reader (no longer selects `m.permissions`) all resolve from
  roles only. Formal invariant **R1** in `final-model.formal.spec.ts`: effective
  permissions are EXACTLY the duplicate-free union of the roles' permissions —
  nothing added, nothing the roles grant dropped. Behaviour-preserving no-op (the
  direct slot was provably empty after 2.D/2.B/2.B′). **Done** (all suites +
  formal/gate/structure green).

- **2.E (safety) — anti-orphan closed on every roles-only mutation path.** In
  the roles-only model, role assignment is how admin is granted/revoked, so the
  invariant "every account keeps ≥1 `permissions.update` holder" now guards all
  three mutations with one uniform rule — _orphaned iff the target was the sole
  admin and the change drops its admin capability_:
  - `assignRoles` gained `{ orphaned }` + `assignWouldOrphanLocked` (and the
    in-memory mirror) — refusing a reassignment that strips the last admin.
  - `removeMember` now decides via `removeWouldOrphanLocked` (= the role-set→∅
    case), so it counts EFFECTIVE (role-derived) admins — fixing the gap where a
    shared-role-only admin's removal bypassed the check — while a non-admin
    removal is never blocked.
  - `updatePermissions` keeps its (correct) one-off demote trigger; the adapter
    count is effective (2.A).
    All verified (contract: `assignRoles` orphan + the existing demote/removal
    cases; api E2E; all suites + formal/gate green). **Done.**

- **2.E (contract) — the direct-permission STORAGE is gone.** The dead
  `memberships.permissions` column is dropped
  (`20260623140000_drop_membership_permissions.sql`, after the 2.D backfill),
  and the in-memory `StoredMembership.permissions` field is removed. All readers
  (resolution, anti-orphan, the one-off display) and writers (provisioning,
  seed, `updatePermissions`) now go through roles only — `oneOffPermissions` /
  `oneOffFromRow` read the personal role, never a direct slot. Done WITHOUT a
  spec sweep: the `permissions` on **input** types (`SeedMembership`,
  `NewIdentityMembership`, the invitation) stay as a convenience — provisioning
  turns them into a personal role at the boundary. `AdminMembershipSnapshot.permissions`
  stays as the one-off display, sourced from the personal role. **Done** (all
  suites + gate/formal/structure green).

**Phase 2 / ADR-0014 is complete.** The model is roles-only end to end: schema,
resolution, every write, the migrated data, and anti-orphan across permission
edits, removals and role reassignment.

**Not done — a separate PRODUCT decision, not cleanup:** "invitations
roleIds-only." An invitation can today carry a one-off `permissions` grant (→ a
personal role on accept), exactly like the provisioning/seed inputs — keeping it
is correct and symmetric. Forbidding it (forcing invitations to grant only
shared roles) changes what an inviter may do, the invitation coherence rule and
the `invitation.created/accepted` domain events; that is a design choice for the
product owner, deliberately not made unilaterally here.

## Phase 2 — roles-only migration runbook (expand → migrate → contract)

Each sub-step is **behaviour-preserving and green at its tip**. The trick:
keep actor-resolution unioning `direct ∪ expand(roles)` until direct is provably
always empty, then flip to roles-only as a no-op. Order matters.

- **2.0 — Personal-role concept (domain).** Add `Role.isPersonal: boolean`
  (default `false`). A personal role is account-scoped, `templateKey: null`,
  `isPersonal: true`, owned by exactly one membership. UI filters it out of the
  org roles list; it is deleted with its membership (cascade) and is never
  "in use" elsewhere. Touch: `libs/domain/src/access/role`, the `RoleStore`
  contract, both adapters, the `roles` migration (`is_personal boolean`).
- **2.1 — Redirect writes to the personal role (resolution still unions).**
  Every path that sets `membership.permissions` upserts the membership's
  personal role instead, and clears the direct list:
  `makeUpdateUserPermissions` (access-admin), `grantStaffPermission` /
  `grantMemberPermission` (flows → the same use case), invitation accept
  (`provisionMembership`/`acceptInvitation`), owner bootstrap +
  `createOrganization`. Effective perms unchanged (union of empty-direct ∪
  personal role). Green.
- **2.2 — Migrate existing rows (non-destructive).** Migration
  `…_roles_only_personal_roles.sql`: for each membership with non-empty
  `permissions`, insert a personal role (perms = those), append its id to
  `role_ids`, set `permissions = '[]'`. Mirror in the in-memory seed transform.
  Behaviour-preserving under the union. Green.
- **2.3 — Flip actor-resolution to roles-only.** `resolveActorPermissions`
  becomes `expandRoles(roles)` (drop the direct-perms parameter + the union);
  actor readers (in-memory + Postgres) stop selecting `permissions`. A no-op now
  that direct is always empty. Add the formal invariant `effective ==
expand(roleIds)`. Green.
- **2.4 — Contract: drop direct permissions (expand-contract).** Remove
  `memberships.permissions` from types (`StoredMembership`, `SeedMembership`,
  `AdminMembershipSnapshot`, `IdentityMembershipSnapshot`) and, one release
  later, the column. Invitations go **roleIds-only** (drop `permissions`; the
  "default member grant" becomes a default member **role**; the invite UI
  already supports role selection). Green.
- **2.5 — Move coherence + anti-orphan onto roles (the subtle one).** Today
  `guardGrantedPermissions` and the atomic anti-orphan guard
  (`holdsAdminCapability` / `hasOtherAdminLocked` / `countAccountAdmins`) read
  the membership's **direct** perms. Re-point them at the membership's
  role-derived perms (`expand(roleIds)`), keeping the `select … for update`
  transactional check. This is the highest-risk edit — cover it with the
  existing admin-repository contract + a formal property.
- **2.6 — Specs/fixtures sweep.** Every test that seeds a membership with
  `permissions: […]` must instead assign a role (or a personal role). This is
  the bulk of the mechanical work; do it adapter-contract-first.
- **2.7 — Verify.** Formal `effective == expand(roleIds)`; quality gate; manual
  security pass on resolution + anti-orphan.

**Rollback.** 2.0–2.3 are independently revertible and behaviour-preserving.
The point of no easy return is the **column drop** in 2.4 — keep the column
nullable/unused for one release (expand-contract) before dropping it, so a
revert to the union path is possible without data loss.

> **Critical coupling discovered while implementing (2026-06-23).** 2.1, 2.3 and
> 2.5 are **NOT independent** — they are one atomic change. The anti-orphan
> guard (`hasOtherAdminLocked` / `countAccountAdmins`) counts admins by reading
> `memberships.permissions @? '$[*] ? (@.action == "permissions.update")'`. The
> moment 2.1 clears the direct list, that guard sees **zero admins** and locks
> every account, UNLESS 2.5 (count admins via `expand(roleIds)`) lands in the
> same step. The actor reader's union (2.3) is in the same blast radius. So the
> safe unit is: **redirect writes to the personal role + re-point the
> anti-orphan/coherence guards onto role-derived perms + flip resolution, all
> together**, on the transactional admin repository (in-memory + Postgres `for
update`) with the admin-repository contract + a formal anti-orphan invariant
> proving "an account always keeps ≥1 `permissions.update` holder" under roles.
> This is the irreducible, auth-critical core of Phase 2 — do it in a dedicated
> session with full context, not as a tail-end increment. **2.0 (the
> `is_personal` field) is done and green and is a safe stopping point.**
>
> **RESOLVED (2026-06-23) by doing 2.A first.** The coupling came from the
> anti-orphan guard reading the _direct_ column. Step **2.A** moved that count to
> **effective** perms (`direct ∪ expand(roleIds)`) — a behaviour-preserving change
> shipped on its own — so clearing the direct slot no longer hides an admin. With
> 2.A in place, **2.B** (redirect writes to the personal role) became a safe,
> independent, green increment instead of an all-or-nothing rewrite. The remaining
> steps (D/C/E/F) are likewise decoupled.
