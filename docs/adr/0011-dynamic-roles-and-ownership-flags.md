# ADR-0011: Dynamic roles as the assignment layer + ownership flags

- Status: Proposed
- Date: 2026-06-19
- Amends: [ADR-0010](0010-authorization-permissions-and-grants.md) (the "no
  roles / presets" decision)

## Context

ADR-0010 made `{ action, scope }` permissions the source of truth and offered
only fixed code **presets** (`owner`/`support`/`customer`) as bundles. Two
problems surfaced in use:

1. **Atomic permissions are tedious to assign** one by one, and a fixed preset
   list can't express the org-specific bundles real admins want.
2. There is no way for an admin to **define their own bundles** without editing
   code.

The obvious fix (user-defined roles) raises the classic questions: snapshot vs
live reference, what happens on delete, double-grant/revocation bugs, and how a
**zero-default** instance (nothing seeded) can bootstrap itself.

## Decision

**Roles are the assignment layer; permissions remain what the policy core
evaluates.** A role only _expands_ to permissions — it never bypasses or
replaces the deny-by-default policy core of ADR-0010.

- **Roles-only assignment.** A membership carries **role references**
  (`roleIds`), not a raw permission list. The actor's effective permissions are
  resolved during actor-resolution as `union(expand(roleIds))` — a **flat
  `{action, scope}` list**, exactly what `evaluateAccessPolicy` already consumes
  (ADR-0010 policy core unchanged).
- **One mechanism, two UX flows.** "Assign a role" references a **shared role**;
  "assign raw actions" creates a **personal (inline) role** owned by that one
  membership. There is no second kind of grant — everything is a role. This
  removes the "sticky direct permission that survives role edits" revocation bug.
- **Live reference, not snapshot.** Editing a role (add _or_ remove an action)
  **propagates** to every holder, because resolution reads the current role.
  Editing a shared role is therefore a high-blast-radius, audited
  (`role.updated`) operation.
- **Delete is blocked-in-use, not materialized.** A shared role in use cannot be
  deleted until it is reassigned/unassigned (or an explicit "delete and revoke
  from N members" with confirmation). We do **not** copy a deleted role's
  actions into memberships — that would create provenance-less permissions that
  defeat clean revocation.
- **No defaults, nothing seeded.** The roles table starts **empty**; presets
  (ADR-0010) are removed. Every role is built by an admin. Roles are never
  hardcoded rows.
- **Ownership is an identity flag, not a role** — and it is what makes a
  zero-default instance bootstrappable:
  - `isRoot` (platform): the policy core short-circuits to **granted at `any`
    scope** — full authority with no role. Replaces the `owner` preset. **One
    carve-out:** grant-only actions (customer data — `GRANT_ONLY_ACTIONS`) are
    NOT bypassed; even root needs an audited impersonation grant (ADR-0010), so
    authority never escapes the audit trail.
  - `isAccountOwner` (per account): short-circuits to **granted at `own` scope**
    for that account — lets a brand-new org admin manage their org from an empty
    role system. Replaces the `customer-admin` preset for the org creator.
  - Flags are membership **identity columns**, not role rows, so "nothing
    hardcoded in the roles system" still holds. There is always ≥1 root
    (`rootAdminExists`, ADR-0010 bootstrap); root is promotable only by root.
- **Invitations carry optional `roleIds`.** Only existing roles, and only roles
  the inviter is allowed to delegate. Zero roles = the invitee exists and can
  log in but holds **no permissions** until a role is assigned; there is no
  "basic access role" because an empty role set _is_ the minimum.
- **Delegation + coherence are unchanged guards.** An assigner can only grant
  roles whose actions they themselves hold (no escalation); a role's actions
  must be coherent for the account kind (`guardGrantedPermissions` — a
  customer-kind role can never hold `any`/staff-only actions). Root/owner flags
  bypass.
- **Provenance is shown, not hidden.** The UI shows, per effective action, which
  role(s) grant it — so overlap is transparent and revocation is "remove from
  every source listed".

## Consequences

- **Policy core stays intact and formally checkable.** New invariants the
  `formal` sensor should prove: _root is always authorized_; _an account owner is
  authorized within its own scope_; _a member with zero roles is denied by
  default_.
- **Editing a shared role re-permissions all holders at once** (add and remove).
  Mitigated by gating it to root/owner-or-role-manager, auditing it, and the
  coherence guard.
- **Deleting a shared role is no longer "free"** (blocked-in-use) — we traded
  free-delete for clean, predictable revocation.
- **One-off grants become personal roles** (no raw-permission path). This is how
  mature RBAC works; the cost is "make a narrow role" instead of "tick one box".
- **Multi-role overlap unions** (an action held via two roles isn't revoked by
  removing it from one) — acceptable and transparent via provenance.
- **Migration is required** (see plan): existing memberships' permission lists
  become a **personal role each** (a snapshot of their current permissions, so
  nothing breaks); the `owner` preset becomes `isRoot`; presets are deleted.

## Implementation plan (by layer — not yet built)

1. **domain** — `Role` (id `RoleId`, name, `accountId | null`, permissions) and
   `RoleId`. Extend the policy core with the `isRoot` / `isAccountOwner`
   short-circuits and add the three formal invariants above. Presets removed
   (kept transiently only to drive migration).
2. **application** — port `RoleStore` (CRUD + `listInUse`); use cases
   `createRole / updateRole / deleteRole (blocked-in-use) / listRoles`,
   `assignRoles / unassignRoles` on a membership, and `expandRoles`. Move role
   expansion into **actor resolution** (`union(expand(roleIds))`). Invitations
   take `roleIds`. Reuse the delegation + `guardGrantedPermissions` guards.
3. **infrastructure** — migration: `roles` table; `membership.role_ids`;
   `membership.is_root` / `membership.is_account_owner`. In-memory + Postgres
   `RoleStore` adapters; actor-resolution join expands roles.
4. **apps/api** — procedures `roles.create/list/update/delete` and member
   `roles.assign/unassign`; the invite procedure accepts `roleIds`.
5. **libs/ui** — a role-manager screen (CRUD) + a member role-assignment editor
   (replaces the raw `permissions.update` form) showing provenance.
6. **migration** — for each existing membership, create a personal role from its
   current permissions and reference it; convert the bootstrap owner to
   `isRoot`; drop presets and the seeded permission lists.
