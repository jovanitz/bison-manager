-- Make RLS the LIVE second line of defense (ADR-0010).
--
-- 20260610201153 enabled RLS on the access tables and wrote "read-your-own"
-- SELECT policies for `authenticated` — but a policy only bites once the
-- PostgREST client role actually holds a table grant. Without the grant every
-- access is denied at the grant layer ("permission denied for table ..."), so
-- the policies were dead code and the RLS contract test could never pass.
-- (Older Supabase applied broad default grants; the current CLI does not, so we
-- declare them explicitly — the schema no longer depends on a CLI default.)
--
-- The API itself never uses these roles: it connects as the table owner, which
-- bypasses RLS, and enforces authorization in the application policy core (the
-- FIRST line). These grants only bound what a client could reach if it talked to
-- PostgREST directly: read-your-own rows, and write nothing.

-- SELECT: authenticated reads its own rows (via the existing policies); anon and
-- the staff-only catalogues (audit_events, role_templates — RLS-enabled with no
-- policy) resolve to zero rows rather than a grant error.
grant select on
  public.accounts,
  public.memberships,
  public.sessions,
  public.access_grants,
  public.audit_events,
  public.role_templates
  to anon, authenticated;

-- Writes: there is no write policy on any access table, so RLS denies every
-- client write. The grant only moves the denial from the grant layer to RLS
-- (the documented "write nothing" line) — the effect is identical, the error is
-- the row-level-security one. anon gets no write grant at all.
grant insert, update, delete on
  public.accounts,
  public.memberships,
  public.sessions,
  public.access_grants,
  public.audit_events
  to authenticated;
