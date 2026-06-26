-- Staff-editable default-role templates (ADR-0013/0014). The catalogue lives in
-- code (ROLE_TEMPLATES) and is the recovery floor; this table holds only the
-- *overrides* a staff member has saved. The key is always a code template key
-- (no custom templates), so the use case merges code with these rows: an absent
-- row means "pristine", a present row means "edited". Reset deletes-by-overwrite
-- (upsert of the code definition); install/reset of org instances read here.
create table if not exists public.role_templates (
  key text primary key,
  scope text not null check (scope in ('platform', 'org')),
  name text not null,
  permissions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Staff-only catalogue: like audit_events, enable RLS with NO policy so it is
-- invisible to every client role (anon/authenticated). The API reaches it only
-- through its service connection, which bypasses RLS; authorization is enforced
-- in the application layer (staff `permissions.update` on the platform scope).
alter table public.role_templates enable row level security;
