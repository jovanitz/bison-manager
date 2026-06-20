-- Dynamic roles (ADR-0011): named permission bundles assigned to memberships.
-- A role belongs to one account (account_id) or the whole platform (NULL).
-- Authorization still evaluates the flat permission list; roles only expand to
-- it (resolved at actor-resolution). Nothing is seeded — every role is built by
-- an admin; root/owner authority is the identity flags below, not a role.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete cascade,
  name text not null,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists roles_account_idx on public.roles (account_id);

-- A membership references roles (ADR-0011, roles-only assignment). Transitional:
-- the existing `permissions` array stays the source until the preset→role
-- migration; actor-resolution unions both.
alter table public.memberships
  add column if not exists role_ids uuid[] not null default '{}';

-- Ownership bypass (ADR-0011): an account owner is authorized within its own
-- account without a role, so a fresh org admin can build roles from empty.
alter table public.memberships
  add column if not exists is_account_owner boolean not null default false;
