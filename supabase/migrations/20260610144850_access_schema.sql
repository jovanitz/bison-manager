-- Access schema (ADR-0010): permissions + temporary grants, no roles.
-- Mirrors the domain types in libs/domain/src/access/. The API resolves the
-- actor from these tables on every request — JWTs prove identity only.
-- RLS is enabled with NO policies here (deny-all for anon/authenticated;
-- the API's service connection bypasses it). Policies arrive in phase 4d as
-- the second line of defense.

-- accounts ------------------------------------------------------------------
-- kind: the CustomerDirectory adapter must only ever surface kind='customer';
-- staff accounts (owner/support memberships) are never impersonation targets.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text,
  kind text not null check (kind in ('customer', 'staff')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

-- memberships (user × account) ----------------------------------------------
-- permissions: jsonb array of {action, scope} — the single persistent source
-- of truth for authorization. Presets (owner/support/customer) are applied by
-- the application, never stored as a role column.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  permissions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(permissions) = 'array'),
  created_at timestamptz not null default now(),
  unique (user_id, account_id)
);

create index memberships_account_id_idx on public.memberships (account_id);
create index memberships_user_id_idx on public.memberships (user_id);

-- sessions ------------------------------------------------------------------
-- Our authorization source of truth. id equals the Supabase Auth session_id
-- claim; Supabase's auth.sessions is identity plumbing only. Revoking here is
-- immediate for everything that goes through the API.
create table public.sessions (
  id uuid primary key,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_membership_id_idx on public.sessions (membership_id);

-- access_grants ---------------------------------------------------------------
-- Temporary, allowlisted elevation (impersonation). actions is an explicit
-- allowlist (never "everything except…"); reason is mandatory by constraint.
create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('impersonation')),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  target_account_id uuid not null references public.accounts (id) on delete cascade,
  actions jsonb not null check (jsonb_typeof(actions) = 'array'),
  reason text not null check (length(trim(reason)) > 0 and length(reason) <= 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  expiry_recorded_at timestamptz,
  check (expires_at > created_at)
);

create index access_grants_membership_id_idx
  on public.access_grants (membership_id);
create index access_grants_target_account_id_idx
  on public.access_grants (target_account_id);

-- audit_events ----------------------------------------------------------------
-- Append-only. Sensitive writes insert their event in the same transaction as
-- the mutation (the port signatures make this unrepresentable otherwise).
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  occurred_at timestamptz not null,
  account_id uuid,
  membership_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index audit_events_type_idx on public.audit_events (type, occurred_at desc);
create index audit_events_account_id_idx
  on public.audit_events (account_id, occurred_at desc);

create or replace function public.audit_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

create trigger audit_events_no_update_delete
  before update or delete on public.audit_events
  for each row execute function public.audit_events_append_only();

-- RLS: fail closed ------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.memberships enable row level security;
alter table public.sessions enable row level security;
alter table public.access_grants enable row level security;
alter table public.audit_events enable row level security;
