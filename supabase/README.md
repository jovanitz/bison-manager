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
- RLS is enabled deny-all from the first migration (fail closed); policies are
  phase 4d. The API talks to Postgres with the service connection and enforces
  authorization in the application layer — RLS is the second line of defense.
