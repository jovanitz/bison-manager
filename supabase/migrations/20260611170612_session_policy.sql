-- Sliding sessions with a per-account-kind policy (business-rules doc):
-- two clocks per session — idle (sliding, pushed by use) and absolute
-- (anchored at login). The API materializes the result into expires_at;
-- the policy core keeps denying on expires_at alone.

-- Activity anchor for the idle clock (and ops visibility of live sessions).
alter table public.sessions
  add column last_seen_at timestamptz;

update public.sessions set last_seen_at = created_at where last_seen_at is null;

-- Runtime-editable session policy (single row). Written only through the
-- API's settings.update use case, which commits policy + audit event + the
-- immediate shrink of live sessions in one transaction. Defaults live in the
-- domain (ACCESS_SESSION_POLICY_DEFAULTS); no row means "defaults".
create table public.access_settings (
  id boolean primary key default true check (id),
  session_policies jsonb not null,
  updated_at timestamptz not null default now()
);

-- Fail closed for clients; the API uses the service connection.
alter table public.access_settings enable row level security;
