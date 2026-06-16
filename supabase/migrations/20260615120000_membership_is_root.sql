-- The protected super-admin (root): the bootstrapped owner membership.
--
-- is_root grants nothing by itself — authorization is still the permissions
-- array. Its only effect is protective: the API refuses any admin mutation
-- whose target is the root unless the actor IS the root, so no permission set,
-- however broad, lets one member compromise the super-admin.
alter table public.memberships
  add column if not exists is_root boolean not null default false;

-- At most one root membership across the whole system.
create unique index if not exists memberships_single_root_idx
  on public.memberships (is_root)
  where is_root;
