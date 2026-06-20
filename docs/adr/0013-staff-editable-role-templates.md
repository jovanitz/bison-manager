# ADR-0013: Staff-editable default-role templates (reset to the live template)

- Status: Proposed
- Date: 2026-06-20
- Amends: [ADR-0012](0012-default-role-templates-and-reset.md) (the "default
  lives in code; reset restores the code baseline" decision)

## Context

ADR-0012 made the factory catalogue **code** and `reset` restore from it. Two
needs surfaced:

1. Staff must curate the client orgs' **default roles without a deploy** — if
   the system seeded a bad default, staff should fix it by editing the template,
   not by shipping code.
2. A client's `reset` should restore to the **staff's current default**, not a
   frozen code snapshot. So: client modifies their copy → reset re-applies the
   version staff has at that moment.

Under ADR-0012, staff edits land on **instances**, never on the template, and
`reset` ignores them. That is the wrong behaviour for "the client defaults are
staff-curated and resettable to the curated version".

## Decision

**Default templates become a staff-editable store; `reset` restores from the
live template. Code is the seed + the recovery floor.**

- **Template ≠ instance.** A _template_ is a default **definition**
  (`{ key, name, scope, permissions }`) — never assigned to a member. An org's
  live role is an _instance_ (`templateKey` → its template). Instances live in
  `roles` (unchanged); templates live in their **own store**.
- **Staff edit templates.** `templates.list / update` (and `templates.reset` to
  the code floor) are staff operations. Org templates (`vendedor`, `admin`,
  `member`…) are the **client defaults**; platform templates are staff's. The
  two sets stay distinct (scope), as today.
- **Code is the seed + floor.** On bootstrap the code catalogue
  (`ROLE_TEMPLATES`) **seeds** the template store (idempotent). A template can be
  **reset to its code definition** — the ultimate floor, so a broken template
  still recovers. Code-derived templates are non-deletable; staff-created custom
  templates are deletable (no code floor) — the same default/custom rule as
  ADR-0012, one level up.
- **`reset(instance)` restores from the LIVE template** (staff's current
  version), falling back to the code definition only if the stored template is
  gone. So a client reset picks up staff's latest curation. Propagation stays
  **opt-in** (existing instances are not auto-rewritten when staff edit a
  template — ADR-0012 unchanged on that).
- **`installDefaults(org)` copies from the live templates**, so a new org starts
  with staff's current defaults (auto-seeded on org creation, ADR-0012).
- **Authorization.** Editing templates is staff-grade (platform scope); a client
  modifies/resets only their own **instances** (own scope) — unchanged.

## Consequences

- Staff can fix a bad default by editing its template; clients pull it on the
  next reset (not automatically). The "fix it by eye" path ADR-0012 lacked.
- The code catalogue's role shifts from _the_ default to the **seed + floor**.
- A new persisted entity (the template store) is added across every layer, plus
  a staff dashboard surface to edit templates. It is roles-shaped but smaller:
  staff edit a fixed (code-seeded) set; custom templates are optional.
- `reset` and `installDefaults` change their **source** from the code catalogue
  to the template store (with code fallback) — a localized change to two use
  cases.

## Implementation plan (by layer — not yet built)

1. **domain** — keep `RoleTemplate` + `ROLE_TEMPLATES` as the seed/floor; a pure
   "apply template to instance" already exists (`resetRoleFromTemplate`) and is
   reused with whichever template (stored or code).
2. **application** — `RoleTemplateStore` port (`list`, `findByKey`, `update`,
   `resetToCode`, optional `create`/`remove` for custom; `seedFromCode`).
   `resetRole` reads the store (fallback code); `installDefaults` copies from the
   store. A `templates` use-case bundle.
3. **infrastructure** — `role_templates` table; in-memory + Postgres adapters;
   bootstrap seeds from code; same contract on both.
4. **apps/api** — procedures `templates.list / update / reset` (staff-gated);
   `reset`/`installDefaults` now read the store.
5. **libs/ui** — a dashboard "Default templates" section (list + edit + reset to
   code), distinct from the live-roles section.
