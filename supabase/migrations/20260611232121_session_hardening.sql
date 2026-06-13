-- Session hardening (cheap now, expensive to retrofit):
-- 1. Context metadata — you cannot backfill what you never captured.
-- 2. Hygiene — dead sessions get purged; live ones get useful indexes.
-- 3. Optimistic locking for the runtime settings row.

-- 1) Context: captured at registration; last_ip refreshed on slides.
alter table public.sessions
  add column if not exists user_agent text,
  add column if not exists created_ip text,
  add column if not exists last_ip text;

-- 2) Settings version (two admins editing must not silently overwrite).
alter table public.access_settings
  add column if not exists version integer not null default 1;

-- 3) Indexes: the concurrent-session cap and the policy shrink walk live
--    sessions per membership; the purge walks dead ones by expiry.
create index if not exists sessions_active_membership_idx
  on public.sessions (membership_id)
  where status = 'active';
create index if not exists sessions_expires_at_idx
  on public.sessions (expires_at);

-- 4) Purge: dead sessions (revoked or expired) older than the retention
--    window disappear; their audit events remain — the trail is the history.
create or replace function public.purge_dead_access_sessions(
  retention interval default interval '30 days'
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  purged integer := 0;
begin
  delete from public.sessions s
  where (s.status = 'revoked' or s.expires_at < now())
    and greatest(s.expires_at, coalesce(s.last_seen_at, s.created_at))
          < now() - retention;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke execute on function public.purge_dead_access_sessions(interval)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
    and not exists (
      select 1 from cron.job where jobname = 'purge-dead-access-sessions'
    )
  then
    perform cron.schedule(
      'purge-dead-access-sessions',
      '0 3 * * *',
      'select public.purge_dead_access_sessions()'
    );
  end if;
end;
$$;
