-- Roles-only model (ADR-0014, Phase 2). A *personal role* is owned by exactly
-- one membership and holds its one-off permissions — the replacement for the
-- per-membership direct permission list that Phase 2 removes. It is
-- account-scoped, never a template, hidden from the org roles list, and removed
-- with its membership. This column is additive; the data migration that turns
-- existing direct permissions into personal roles lands in a later sub-step.
alter table public.roles
  add column if not exists is_personal boolean not null default false;
