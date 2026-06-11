# Supabase (local-first)

Postgres + Auth for the access system (ADR-0010). Everything here runs
locally in Docker — no credentials, no cloud project needed for development.

```bash
supabase start     # boot local stack (applies migrations + seed.sql)
supabase stop      # shut it down
supabase db reset  # re-apply migrations + seed from scratch
supabase status    # URLs and local keys (API :54321, DB :54322, Studio :54323)
```

The local `anon`/`service_role` keys printed by `status` are public,
well-known development keys — they are not secrets. Real project credentials
enter only via env at the API composition root (see docs/ai/security.md).

- Schema: [migrations/](migrations/) — accounts, memberships (user × account,
  permissions as data), sessions (authorization source of truth; Supabase's
  auth.sessions is identity plumbing only), access_grants, audit_events
  (append-only by trigger).
- RLS is the **second** line of defense (the first is the application policy
  core, enforced by the API per request over its service connection): clients
  may read their own rows only (accounts/memberships/sessions/grants via
  `private.actor_*_ids()` security-definer helpers) and write **nothing** —
  no insert/update/delete policies exist. `audit_events` has no policy at
  all: the trail is invisible to client roles; reading it requires the
  `audit.read` permission through the API.
- `grant.expired` is recorded lazily in-request AND punctually by
  `public.record_expired_access_grants()` (same dedup column, same payload),
  scheduled every minute via pg_cron when the extension is available.
- Audit retention (decision): **no automated purge** — append-only integrity
  wins over storage. Revisit on a concrete compliance need; monthly
  partitioning is the upgrade path. Verified by
  `libs/infrastructure/src/access/postgres-rls.spec.ts`.
