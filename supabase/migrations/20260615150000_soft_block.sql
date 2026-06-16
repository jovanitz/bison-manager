-- Soft block (org + identity): a blocked subject still authenticates, but the
-- policy denies every permission/grant-gated operation. Distinct from the hard
-- account `disabled` status (which fails at actor resolution → 401).

-- Org-level soft block.
alter table public.accounts
  add column if not exists blocked boolean not null default false;

-- Identity-level soft block (the user across every org).
create table if not exists public.blocked_identities (
  user_id uuid primary key references auth.users (id) on delete cascade,
  blocked_at timestamptz not null default now(),
  reason text
);

-- Fail closed for clients; the API uses the service connection.
alter table public.blocked_identities enable row level security;
