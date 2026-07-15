<!-- GENERATED FILE — do not edit by hand.
     Source of truth: the code (libs/domain/src/access, apps/api registry,
     supabase/config.toml). Regenerate: pnpm harness rules --write
     The gate fails while this file is stale (pnpm harness rules). -->

# Access — business rules

> Covers the EXISTING giro's API (`apps/api`) and vocabulary — each giro gets
> its own generated rules doc (ADR-0017).

Human-readable representation of the authorization system (ADR-0010). Every
table below is derived from — or executed against — the real code.

## Principles

- **Roles expand to permissions; temporary grants for elevation.** A membership
  carries **roles** (named bundles, ADR-0011) that expand to the flat
  action+scope permission list the policy core evaluates; the presets below are
  the seed templates (ADR-0012/0013). Audited, expiring **grants** add narrow
  elevations (impersonation). Nothing ever asks "is this user an owner?".
- **Deny by default, fail closed.** Anything not explicitly allowed is denied;
  a disabled account or revoked/expired session denies everything.
- **The token never authorizes.** A JWT only proves identity; permissions,
  grants and statuses are loaded fresh from the database on every request, so
  revocation is immediate.
- **Every sensitive action is audited atomically** — the mutation and its
  audit event commit in one transaction.

## Durations

Sessions run on **two clocks — whichever ends first wins**: an idle
window that *slides forward on every authenticated request*, and an
absolute lifetime anchored at login that never slides. Defaults below
are **runtime-editable** via `settings.update` (within the hard bounds);
tightening shrinks every live session immediately, loosening is only
gained through later activity.

| Rule | Value | Source of truth |
| --- | --- | --- |
| Access token (identity proof only — never authorizes) | 60 min | `supabase/config.toml` → `jwt_expiry` |
| Customer session — idle (sliding) | 1 d | `ACCESS_SESSION_POLICY_DEFAULTS.customer` |
| Customer session — absolute max | 3 d | `ACCESS_SESSION_POLICY_DEFAULTS.customer` |
| Staff session — idle (sliding) | 30 min | `ACCESS_SESSION_POLICY_DEFAULTS.staff` |
| Staff session — absolute max | 12 h | `ACCESS_SESSION_POLICY_DEFAULTS.staff` |
| Policy hard bounds (runtime edits) | idle ≥ 5 min · max ≤ 30 d · staff ≤ customer | `makeAccessSessionPolicies` |
| Slide write threshold | 5 min | `ACCESS_SESSION_SLIDE_THRESHOLD_MS` |
| Concurrent sessions per membership | 5 (oldest is revoked, audited) | `ACCESS_SESSION_MAX_CONCURRENT` |
| Dead-session purge | after 30 d (audit events remain) | `ACCESS_SESSION_PURGE_AFTER_DAYS` + pg_cron |
| Impersonation grant — default | 30 min | `IMPERSONATION_GRANT_DEFAULT_MINUTES` |
| Impersonation grant — maximum | 60 min | `IMPERSONATION_GRANT_MAX_MINUTES` |
| Grant reason | mandatory, ≤ 500 chars | `ACCESS_GRANT_REASON_MAX` |
| Invitation expiry | 7 d (pending, unaccepted) | `ACCESS_INVITATION_TTL_DAYS` |

## Who can do what (presets)

| Action | Meaning | owner | support | customer | customer-admin |
| --- | --- | --- | --- | --- | --- |
| `account.disable` | Disable an account (blocks login, refresh and actions) | ✅ any account | — | — | — |
| `account.enable` | Re-enable a disabled account (the undo; unexpired sessions resume) | ✅ any account | — | — | — |
| `account.promote` | Promote a customer account to staff (strict sessions, not impersonable) | ✅ any account | — | — | — |
| `account.demote` | Demote a staff account back to customer, stripping its staff-grade permissions | ✅ any account | — | — | — |
| `account.delete` | Schedule or cancel an org deletion (staged soft-delete, reversible grace window) | ✅ any account | — | — | — |
| `permissions.update` | Replace the persistent permissions of a membership | ✅ any account | — | — | ✅ own account |
| `sessions.revoke` | Revoke a session immediately (kills refresh tokens too) | ✅ any account | — | ✅ own account | ✅ own account |
| `sessions.read` | List a membership's sessions with device/IP context (active-sessions view) | ✅ any account | — | ✅ own account | ✅ own account |
| `staff.read` | List the staff (platform-internal) directory | ✅ any account | — | — | — |
| `access.block` | Soft-block / unblock an org or identity (can sign in, cannot operate) | ✅ any account | — | — | — |
| `customer.search` | Search the customer directory | ✅ any account | ✅ any account | — | — |
| `customer.read` | Read a customer account | — | — | ✅ own account | ✅ own account |
| `impersonation.start` | Open a view-only impersonation grant on a customer | — | ✅ any account | — | — |
| `impersonation.end` | End an impersonation grant (holder only) | — | ✅ any account | — | — |
| `audit.read` | Read the audit trail | ✅ any account | — | — | ✅ own account |
| `settings.update` | Reconfigure the session lifetime policy (within hard bounds) | ✅ any account | — | — | — |
| `members.invite` | Invite an email into an existing account with explicit permissions | ✅ any account | — | — | ✅ own account |
| `members.read` | List an account's memberships with their permissions | ✅ any account | — | — | ✅ own account |
| `members.remove` | Remove a membership from its account (sessions die with it) | ✅ any account | — | — | ✅ own account |
| `members.block` | Soft-block one member inside your own org (own scope): they can sign in but cannot operate | — | — | — | ✅ own account |
| `plans.manage` | Administer the plan catalog and staff billing levers (ADR-0016) — owner-only in v1 | ✅ any account | — | — | — |
| `billing.read` | Read an org's billing summary: plan, phase, seats, trial/paid dates (staff any, org admin own) | ✅ any account | ✅ any account | — | ✅ own account |
| `identity.delete` | Purge an ORPHAN auth identity (no membership anywhere) — irreversible, owner-only | ✅ any account | — | — | — |

Presets are starting bundles: an owner can change any membership's
permissions afterwards (`permissions.update` is root-equivalent — whoever
holds it can grant themselves anything *within the coherence rules below*).

## What can live inside a customer organization

Customer organizations (kind `customer`) may only ever hold this subset
of actions — `permissions.update` and `members.invite` refuse anything
else (`app/not-delegable-to-customer`), **even from the owner** and even
with `own` scope. `any` scope additionally requires a staff account
(`app/requires-staff-account`). Everything outside the list (disabling
accounts, promoting, impersonation, session policy, the directory) is
platform-staff machinery.

`customer.read` · `sessions.revoke` · `sessions.read` · `members.invite` · `members.read` · `members.remove` · `members.block` · `permissions.update` · `audit.read` · `billing.read`

**Anti-orphan rule:** every account always keeps at least one membership
holding `permissions.update` (the root-equivalent capability). A
`permissions.update` that would demote the last administrator, or a
`members.remove` of the last administrator, is refused
(`app/cannot-orphan-account`) — an account can never be left ungovernable
from within (the platform owner stays the only external fix).

## Impersonation

- Grants are an **allowlist**: impersonation authorizes exactly `customer.read` — nothing else, on **one** target account.
- A reason is **mandatory** (audited verbatim).
- Duration: 30 min by default, hard cap 60 min.
- The actor **always remains the support agent** — no token is ever minted as the customer; the audit records who looked at what and why.
- Only the grant holder can end it early; expiry ends it automatically.
- Note: `support` deliberately lacks `customer.read` as a permission — reading customer data is only ever reachable through an active grant.

## Decisions, executed

The rows below are **run through the real policy core** when this document is
generated — they are behavior, not documentation:

| Actor | State | Action | Target | Decision |
| --- | --- | --- | --- | --- |
| owner | active | `account.disable` | a customer account | ✅ allowed (via permission) |
| owner | active | `audit.read` | audit trail (system) | ✅ allowed (via permission) |
| owner | active | `impersonation.start` | a customer account | ⛔ denied — not-permitted |
| owner | account disabled | `audit.read` | audit trail (system) | ⛔ denied — account-disabled |
| owner | session revoked | `audit.read` | audit trail (system) | ⛔ denied — session-revoked |
| support | active | `customer.search` | customer directory | ✅ allowed (via permission) |
| support | no grant | `customer.read` | a customer account | ⛔ denied — not-permitted |
| support | active grant on that account | `customer.read` | the granted account | ✅ allowed (via grant) |
| support | active grant on that account | `customer.read` | a DIFFERENT account | ⛔ denied — not-permitted |
| support | grant EXPIRED | `customer.read` | the granted account | ⛔ denied — not-permitted |
| support | active | `account.disable` | a customer account | ⛔ denied — not-permitted |
| customer | active | `customer.read` | their OWN account | ✅ allowed (via permission) |
| customer | active | `customer.read` | ANOTHER account | ⛔ denied — not-permitted |
| customer | active | `sessions.revoke` | their OWN account | ✅ allowed (via permission) |
| customer | active | `audit.read` | audit trail (system) | ⛔ denied — not-permitted |
| customer-admin | active | `members.remove` | a member of their OWN organization | ✅ allowed (via permission) |
| customer-admin | active | `members.remove` | a member of ANOTHER organization | ⛔ denied — not-permitted |
| customer-admin | active | `audit.read` | their OWN organization's audit slice | ✅ allowed (via permission) |
| customer-admin | active | `audit.read` | audit trail (system) | ⛔ denied — not-permitted |

## API surface

| Procedure (`POST /rpc/<name>`) | Required action | Summary |
| --- | --- | --- |
| `access.current` | — (any authenticated actor) | The caller's current access snapshot: permissions, active grants, session. |
| `audit.list` | `audit.read` | Read the append-only security audit trail. |
| `account.disable` | `account.disable` | Disable an account; every session on it is denied from the next request. |
| `account.enable` | `account.enable` | Re-enable a disabled account (old sessions stay dead). |
| `account.promote` | `account.promote` | Promote a customer account to staff: strict session policy and out of the customer directory (never impersonable again). |
| `account.demote` | `account.demote` | Demote a staff account back to customer: strips its staff-grade permissions, re-binds sessions to the customer policy, and returns it to the customer directory. Refused for the root account. |
| `account.schedule-deletion` | `account.delete` | Mark an org for deletion (staged soft-delete, reversible until the purge date). Staff-only; refused for the root account. |
| `account.cancel-deletion` | `account.delete` | Withdraw a scheduled org deletion; the org is fully active again. |
| `permissions.update` | `permissions.update` | Replace a membership's permission list (the source of truth). |
| `sessions.revoke` | `sessions.revoke` | Revoke a session; it stops authorizing immediately. |
| `sessions.revoke-all` | `sessions.revoke` | Log a membership out everywhere: revokes all of that membership's active sessions (audited one by one). |
| `sessions.list` | `sessions.read` | A membership's sessions with their captured context (device, IPs, activity) — the "active sessions" view. |
| `org.block` | `access.block` | Soft-block a whole org: members can sign in but cannot operate. |
| `org.unblock` | `access.block` | Lift an org soft-block. |
| `identity.block` | `access.block` | Soft-block an identity across every org: can sign in, cannot operate. |
| `identity.unblock` | `access.block` | Lift an identity soft-block. |
| `members.block` | `members.block` | Org admin soft-block of one member inside their OWN org (own scope): the member can sign in but cannot operate in that org. |
| `members.unblock` | `members.block` | Lift a member soft-block within your org. |
| `staff.list` | `staff.read` | List every staff (platform-internal) account — the staff directory the admin dashboard renders. Staff-only; never customer-visible. |
| `customers.list` | `customer.search` | List every customer account — the customer directory the admin dashboard renders. Same permission as customer.search, no term needed. |
| `identities.delete` | `identity.delete` | Purge an ORPHAN auth identity (a sign-up that joined no org). Irreversible; the server re-verifies orphanhood and refuses otherwise. |
| `identities.orphaned` | `staff.read` | List org-less ("zombie") auth identities — sign-ups belonging to no account — for platform cleanup. Staff-only, gated by staff.read. |
| `customer.search` | `customer.search` | Find customer accounts by name or email (support workflow). |
| `customer.read` | `customer.read` | Read one customer account. Customers read their own; support needs an active impersonation grant on that exact account. |
| `impersonation.start` | `impersonation.start` | Open a view-only, expiring, reasoned window into one customer account. The actor stays the support agent. |
| `impersonation.end` | `impersonation.end` | End an impersonation grant early (only its holder may). |
| `settings.read` | `settings.update` | Read the current session lifetime policy + its version (for the editor). |
| `settings.update` | `settings.update` | Reconfigure the session lifetime policy (per account kind, within hard bounds). Tightening shrinks every live session immediately. |
| `members.list` | `members.read` | An account's memberships with their permissions — the organization members view (own account for org admins, any for platform staff). |
| `members.remove` | `members.remove` | Remove a member from their account; their sessions die in the same transaction. Never your own membership. |
| `members.invite` | `members.invite` | Invite an email into an existing account with explicit permissions and/or roles; the invited identity joins on its first login (7-day expiry). |
| `invitations.pending` | `staff.read` | List unexpired, unactivated invitations — the dashboard pending list. Never returns tokens (only the hash is stored); regenerate for a link. |
| `invitations.regenerate` | `members.invite` | Rotate a pending invitation’s one-time link (new token + expiry); returns the fresh token once, like creation. |
| `invitations.revoke` | `members.invite` | Withdraw a pending invitation before it is accepted — the undo of an invite. Its link stops activating; 404 if nothing pending matched. |
| `invitations.resend` | `members.invite` | Email the invitee a fresh activation link. Resending necessarily ROTATES the token (only its hash is stored), so the previous link dies. |
| `memberships.mine` | — (any authenticated actor) | The caller's own organizations — feeds the organization switcher. |
| `session.switch-account` | — (any authenticated actor) | Re-bind the current session to ANOTHER of your own memberships; expiry is recomputed under the target account's policy. |
| `org.summary` | `customer.search` | Read a customer org's admin metadata (name, status, created). Same permission as the customer directory (customer.search) — no grant, administrative, never impersonation. |
| `org.members` | `members.read` | List a customer org's member roster (members.read). An administrative read of who belongs to the org — distinct from impersonation. |
| `roles.create` | `permissions.update` | Create a permission bundle: platform-wide (accountId null) or scoped to one customer org. Account-scoped roles may not hold any-scoped power. |
| `roles.list` | `permissions.update` | List the roles available to an account: the platform-wide roles plus that account's own (accountId null lists platform roles only). |
| `roles.update` | `permissions.update` | Rotate a role's name and permission set (live reference: every membership holding it sees the change on its next request). |
| `roles.delete` | `permissions.update` | Delete a custom role (refused while in use). A default role is refused too — reset it instead (ADR-0012), so authority never vanishes silently. |
| `roles.assign` | `permissions.update` | Replace a membership's role assignment with the given set (ADR-0011, roles-only). Each role must exist and be reachable by the account. |
| `roles.reset` | `permissions.update` | Reset a default role to its factory template (name + permissions, same id, assignments kept). Custom roles have no template and are refused. |
| `templates.list` | `permissions.update` | List the default-role templates: the code catalogue with staff edits applied over it (the recovery floor is always the code definition). |
| `templates.update` | `permissions.update` | Edit a default template's name and permissions (ADR-0013). Coherence is checked against the template's own scope; the key must exist. |
| `templates.reset` | `permissions.update` | Reset a default template to its code definition — the recovery floor (ADR-0013). Discards staff edits for that template key. |
| `templates.apply-all` | `permissions.update` | Force every live instance of a template — synced or forked — back to the template (ADR-0014). Overrides org-local edits; returns the count. |
| `plans.list` | `plans.manage` | List the FULL plan catalog — hidden and retired included. Staff-only: hidden plan names encode who got special terms. |
| `plans.create` | `plans.manage` | Register a new plan: entitlements, trial months, optional price (null = undecided). The key is a stable unique slug customers never see. |
| `plans.preview` | `plans.manage` | Preview the blast radius of a plan edit before committing: subscriber count, how many orgs would go over-limit or lose a feature. |
| `plans.update` | `plans.manage` | Edit a plan — entitlement changes propagate LIVE to every subscriber. CAS-guarded by expectedVersion; audited with full before/after terms. |
| `plans.retire` | `plans.manage` | Retire a plan — never delete: frozen and closed to ALL new subscriptions, even staff. The default plan cannot be retired. |
| `plans.reset` | `plans.manage` | Restore a live plan to its code floor (DEFAULT_PLANS). A reset is a mass live-edit in disguise: same audit payload and CAS gate as update. |
| `plans.setDefault` | `plans.manage` | Move the singular default-for-new-orgs marker to an active, public plan. Audited as billing.default-plan-changed. |
| `plans.subscribers` | `plans.manage` | List a plan's subscribed orgs (accountId, since when) — the minimum staff instrument for edits, appeasement and cleanup. |
| `billing.summary` | `billing.read` | Read one org's billing state: plan, derived phase, seats, trial/paid dates, hold flag. Reachable under a billing hold — the pay moment. |
| `billing.markPaid` | `plans.manage` | Staff lever: mark an org paid through an absolute DATE (manual-era payment webhook). Optional amount note feeds the collection ledger. |
| `billing.extendTrial` | `plans.manage` | Staff lever: set an org's trial end to an absolute DATE — the ONLY way a new trial is ever granted (plan changes never regrant one). |
| `billing.changePlan` | `plans.manage` | Staff lever: move an org to another plan (staff-only in v1). Retired plans are refused; hidden+active is assignable (legacy/custom home). |
| `billing.setOverride` | `plans.manage` | Staff lever: set (or clear with null) the per-org entitlement exception — "you keep 25 seats" is one override, not a new plan. |
| `billing.coverage` | `billing.read` | Read one org's derived billing coverage: paid-through, outstanding balance, lifecycle phase (grace/suspended/…) and the dormant flag. |

Enforcement never relies on this table's "required action": every use case
re-authorizes itself with the concrete resource in hand.

## Audit events

| Event | Meaning |
| --- | --- |
| `login.succeeded` | A verified identity registered a session |
| `login.failed` | A password check failed (reported by the auth provider hook) |
| `account.disabled` | An account was disabled, by whom and why |
| `account.enabled` | A disabled account was re-enabled, by whom |
| `account.promoted` | A customer account became staff, by whom |
| `account.demoted` | A staff account was returned to customer (staff permissions stripped), by whom |
| `account.deletion-scheduled` | An org was marked for deletion (reversible until the purge date), by whom |
| `account.deletion-canceled` | A scheduled org deletion was withdrawn, by whom |
| `permissions.updated` | Permissions replaced (records before and after) |
| `member.roles-assigned` | A membership's role assignment was replaced (records the new role set) |
| `session.revoked` | A session was revoked, by whom |
| `impersonation.started` | Support opened a view-only grant (with reason) |
| `impersonation.ended` | The grant holder ended an impersonation |
| `grant.expired` | An expired grant was recorded (lazy or pg_cron) |
| `invitation.created` | An email was invited into an account (with which permissions, by whom) |
| `invitation.accepted` | The invited identity logged in and joined the account |
| `invitation.revoked` | Staff withdrew a pending invitation before acceptance (its link stops activating) |
| `identity.deleted` | An orphan identity (no membership anywhere) was purged from the auth provider |
| `member.removed` | A membership was removed from its account, by whom (sessions included) |
| `session.switched` | A user re-bound their session to another of their own memberships |
| `settings.updated` | The session policy was reconfigured (records before and after) |
| `owner.bootstrapped` | The one-time env-driven owner promotion ran |
| `access.blocked` | An org or identity was soft-blocked (can sign in, cannot operate) |
| `access.unblocked` | A soft block on an org or identity was lifted |

## Owner bootstrap

With no root admin in the system, the first sign-in whose email equals
`BOOTSTRAP_OWNER_EMAIL` (env, read only by the API composition root) is
promoted to owner exactly once, emitting `owner.bootstrapped`. Afterwards
the variable is inert.
