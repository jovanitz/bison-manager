-- Invitations: the only way a user joins an EXISTING account (the
-- onboarding consumes them atomically on the invited email's first login).
create table if not exists public.invitations (
  id uuid primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  email text not null,
  permissions jsonb not null check (jsonb_typeof(permissions) = 'array'),
  invited_by uuid not null references public.memberships (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists invitations_pending_email_idx
  on public.invitations (lower(email))
  where accepted_at is null;

-- Fail closed for clients; the API uses the service connection.
alter table public.invitations enable row level security;
