# ADR-0010: Authorization via permissions + temporary grants (no roles)

- Status: Accepted
- Date: 2026-06-09

## Context

The app needs an owner/admin, a support team that can view customer accounts,
and normal customers — across SPA, SSR, mobile, desktop and future AI agents
(tools behind an AI gateway). Classic role checks (`if (user.isAdmin)`) rot:
they multiply into rigid hierarchies, leak into UI code, and make temporary
elevation (support impersonation) either over-privileged or hacky. Token-borne
authorization (roles/permissions as JWT claims) makes revocation latency-bound.

## Decision

- **Permissions, not roles, are the source of truth.** A membership
  (user × account) holds a list of `{ action, scope }` permissions. "Owner",
  "support" and "customer" exist only as administrative **presets** that expand
  to permission lists (`libs/domain/src/access/presets.ts`).
- **Temporary elevation is a grant**: allowlisted actions (never "everything
  but destructive"), a single target account, a mandatory reason, an expiry,
  and an audit event. Support impersonation is a view-only grant; the actor
  always remains the support agent — no token is ever minted as the customer.
- **One pure policy core** decides everything:
  `evaluateAccessPolicy({ actor, action, resource, now })` in
  `libs/domain/src/access/policy/`. Deny-by-default, fail-closed (disabled
  account / revoked or expired session / expired or revoked grant ⇒ deny).
- **Tokens prove identity only.** The API resolves the actor (account status,
  session, permissions, grants) from persisted state on each request, so
  revocation and permission changes are immediate. Supabase RLS is a second
  line of defense, never the primary authorization.
- **Audit is transactional by construction.** Sensitive write ports take the
  audit event as a parameter; adapters persist mutation + event in one
  transaction. `grant.expired` is recorded lazily on first observation
  (a pg_cron sweep may add punctuality later, reusing the same domain
  functions).
- **Owner bootstrap** is env-driven (`BOOTSTRAP_OWNER_EMAIL`, read only in the
  API composition root): promote once, when no owner exists, emitting
  `owner.bootstrapped`. Never a hardcoded email.

## Consequences

- UI and AI tools share the same enforcement: screens hide what the policy
  would deny (via `getCurrentAccess`), but only the policy decides.
- New capabilities = a new `AccessAction` + preset/permission updates; the
  closed action union means an unknown action cannot even be expressed.
- The policy core is portable and headless-testable; authorization rules are
  unit-tested without any backend.
- Multi-account-per-user is supported from day one through memberships, even
  while each user has exactly one.
