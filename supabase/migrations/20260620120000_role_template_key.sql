-- Default role templates (ADR-0012): provenance on each role. `template_key`
-- is null for a custom role, or the factory template key it derives from
-- (resettable, non-deletable). The catalogue itself lives in code; this only
-- records which template a live role instance came from.
alter table public.roles
  add column if not exists template_key text;

-- At most one live role per (account, template) — `nulls not distinct` so the
-- platform scope (account_id null) is also constrained to one per template.
create unique index if not exists roles_account_template_idx
  on public.roles (account_id, template_key)
  nulls not distinct
  where template_key is not null;
