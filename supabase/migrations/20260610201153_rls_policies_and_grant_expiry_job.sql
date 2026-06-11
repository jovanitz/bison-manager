-- Phase 4d: defense in depth (ADR-0010).
--
-- RLS is the SECOND line of defense: the API enforces authorization in the
-- application policy core on every request through its service connection
-- (which bypasses RLS). These policies only bound what a client could reach
-- if it ever talked to PostgREST directly: read-your-own rows, write nothing.
--
-- Audit retention (documented decision): no automated purge. audit_events is
-- append-only by trigger; weakening that for a purge job is a worse trade
-- than storage. Revisit when a compliance requirement (GDPR erasure, data
-- minimisation) arrives — partitioning by month is the upgrade path.

-- Helper functions: SECURITY DEFINER so policy subqueries don't recurse into
-- the memberships RLS. Locked search_path; not callable by clients directly.
create schema if not exists private;

create or replace function private.actor_membership_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.memberships where user_id = (select auth.uid());
$$;

create or replace function private.actor_account_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select account_id from public.memberships where user_id = (select auth.uid());
$$;

revoke execute on function private.actor_membership_ids() from public, anon;
revoke execute on function private.actor_account_ids() from public, anon;
-- The SELECT policies below invoke these as the querying role.
grant execute on function private.actor_membership_ids() to authenticated;
grant execute on function private.actor_account_ids() to authenticated;

-- Read-your-own policies (SELECT only; no write policies exist, so any
-- direct client INSERT/UPDATE/DELETE fails closed under RLS).
create policy "members read own accounts"
  on public.accounts for select to authenticated
  using (id in (select private.actor_account_ids()));

create policy "members read own memberships"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy "members read own sessions"
  on public.sessions for select to authenticated
  using (membership_id in (select private.actor_membership_ids()));

create policy "members read own grants"
  on public.access_grants for select to authenticated
  using (membership_id in (select private.actor_membership_ids()));

-- audit_events: intentionally NO policy — invisible to every client role.
-- Reading the trail requires the audit.read permission, enforced by the API.

-- Punctual grant.expired recording (complements the lazy in-request path;
-- same dedup via expiry_recorded_at, payload identical to the app's).
create or replace function public.record_expired_access_grants()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  expired_count integer := 0;
begin
  with expired as (
    update public.access_grants
    set expiry_recorded_at = now()
    where revoked_at is null
      and expiry_recorded_at is null
      and expires_at <= now()
    returning id, membership_id, target_account_id, expiry_recorded_at
  ), audited as (
    insert into public.audit_events
      (type, occurred_at, account_id, membership_id, payload)
    select
      'grant.expired',
      e.expiry_recorded_at,
      e.target_account_id,
      e.membership_id,
      jsonb_build_object(
        'type', 'grant.expired',
        'grantId', e.id,
        'membershipId', e.membership_id,
        'targetAccountId', e.target_account_id,
        'occurredAt',
          to_char(e.expiry_recorded_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    from expired e
    returning 1
  )
  select count(*) into expired_count from audited;
  return expired_count;
end;
$$;

revoke execute on function public.record_expired_access_grants()
  from public, anon, authenticated;

-- Schedule via pg_cron when available (Supabase local and hosted have it).
-- If the extension cannot be created, lazy in-request recording still covers
-- correctness; the job only adds punctuality.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable (%); skipping schedule.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron')
    and not exists (
      select 1 from cron.job where jobname = 'record-expired-access-grants'
    )
  then
    perform cron.schedule(
      'record-expired-access-grants',
      '* * * * *',
      'select public.record_expired_access_grants()'
    );
  end if;
end;
$$;
