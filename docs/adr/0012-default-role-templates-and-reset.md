# ADR-0012: Default role templates (factory baseline) + reset

- Status: Proposed
- Date: 2026-06-20
- Amends: [ADR-0011](0011-dynamic-roles-and-ownership-flags.md) (the "No
  defaults, nothing seeded" decision and its Phase-6 "drop presets" plan)

## Context

ADR-0011 started the roles table **empty** — a clean zero-default bootstrap
where every role is built by hand. In use, two needs surfaced:

1. The app should come **organized out of the box**: a known-good set of role
   types (e.g. `admin`, `vendedor`) so operators don't rebuild the same bundles
   by hand.
2. There must be a **safety net**: if someone edits a role and breaks something,
   they need a guaranteed way back to a starting point. An empty-start model has
   no floor — a bad edit is just lost.

This applies to platform (staff) roles and, per organization, to client roles —
a client admin who breaks _their_ `vendedor` must be able to restore _their_
copy without touching another org's.

ADR-0011's Phase 6 planned to **drop** the ADR-0010 presets. This ADR reframes
that: the presets **become** the seed templates instead of being deleted.

## Decision

A **factory catalog in code** is the immutable baseline; live roles are fully
editable; **reset** restores a role to its factory definition.

- **Factory catalog (code, pure data).** `RoleTemplate { key, name,
scope: 'platform' | 'org', permissions }` lives in `domain`, version-controlled
  and reviewed by PR. It is the single source of "default" and the guaranteed
  floor: whatever happens in the UI, the baseline survives in code. Changing a
  template is a deliberate, reviewed deploy. This is the **only** hardcoded
  roles data, and it is data — so "nothing hardcoded you can't control" from
  ADR-0011 still holds (you edit live roles freely; the code baseline is only the
  recovery point).
- **Provenance on every live role: `templateKey: string | null`.**
  - **Template-derived** (`templateKey != null`): **cannot be deleted**, can be
    modified, and can be **reset**.
  - **Custom** (`templateKey == null`): created/deleted freely (still
    blocked-in-use per ADR-0011); no reset (nothing to reset to).
- **Reset = full restore.** Reset overwrites a role's **name and permissions**
  from `factory[templateKey]`, **keeping the same role id** — so existing member
  assignments survive the reset. It is the real "back to how it shipped" net.
- **Auto-instantiation.** Platform templates are materialized once
  (`accountId: null`) at bootstrap; org templates are materialized **per
  organization at creation** (`accountId = org`). Each org gets its own editable
  copies, which is what makes per-org reset isolated.
- **Uniqueness.** At most one live role per `(accountId, templateKey)`, so reset
  and identity are unambiguous.
- **Templates do not auto-propagate.** Editing a template in code does **not**
  silently rewrite already-instantiated live roles; **reset** is the opt-in way
  to pull the new baseline. Propagation stays explicit and auditable.
- **Phased capability gate — no redesign later.** Modify/reset is gated by the
  existing `permissions.update` action.
  - **Phase 1 (now):** only **staff** (any-scope) create/modify/reset role types;
    the **client admin only assigns** existing roles to members of their org.
  - **Later:** open the same action to the **client admin** on their own scope
    (`own`) so they modify and reset _their_ org's roles. The per-org isolation
    and the deny-by-default own/any scoping already exist — this is opening a
    gate, not new machinery, rolled out as clients need it.
- **Unchanged from ADR-0011.** Roles still only _expand_ to permissions; the
  deny-by-default policy core is untouched; ownership flags (`isRoot` /
  `isAccountOwner`) still bootstrap a fresh instance; delegation + coherence
  guards still apply.

## Consequences

- **ADR-0011's "nothing seeded" is amended to "seeded from code, fully editable,
  resettable."** The spirit (you control everything; nothing immutable lives in
  the DB) is preserved — the immutable part is version-controlled code, and the
  DB holds only editable instances.
- **Phase 6 reframed.** Presets are not dropped; they become the factory
  templates. Existing memberships' permission lists still become a personal
  (custom) role each per ADR-0011; the standard bundles now also exist as
  resettable defaults.
- **A bad edit always has a floor.** Reset(role) → exactly `factory[templateKey]`
  (name + permissions), same id. Accidental breakage is one click from recovery.
- **Defaults are protected.** Template-derived roles can never be deleted (only
  reset/modified), extending ADR-0011's blocked-in-use delete to "blocked for
  defaults".
- **Per-org safety.** Because each org owns its instances, a client admin (later)
  resets only their org's copy.
- **Evolution path.** If staff later need to define defaults **without a deploy**,
  the catalog can move to a staff-editable "template" store that itself resets to
  the code floor — additive, not a rewrite.

New invariants the `formal` sensor should pin:

- a template-derived role is never deletable;
- `reset(role)` yields a role with the same id and exactly the template's name +
  permissions;
- at most one live role per `(accountId, templateKey)`.

## Implementation plan (by layer — not yet built)

1. **domain** — `RoleTemplate` + the factory catalog (platform + org templates,
   derived from the ADR-0010 presets); `Role.templateKey`; a pure
   `resetRoleFromTemplate(role, template)` (same id, template name + permissions).
2. **application** — `RoleStore` persists `templateKey`; delete refuses
   `templateKey != null`; use cases `resetRole` and `installDefaults`
   (idempotent instantiate). Onboarding instantiates org templates on org
   creation. `createRole` stays for custom roles.
3. **infrastructure** — migration: `roles.template_key` + a unique index on
   `(account_id, template_key) where template_key is not null`; in-memory +
   Postgres adapters; org-creation seeds the org templates.
4. **apps/api** — procedure `roles.reset`; `roles.list` exposes `templateKey`
   (an `isDefault` flag); `roles.delete` refuses defaults.
5. **libs/ui** — a "Reset to default" control on default roles; hide delete on
   defaults; a "default" badge.
6. **capability** — Phase-1 gate (staff only); later open `permissions.update`
   on roles to the client admin at `own` scope.
