-- Invitations can carry role assignments (ADR-0011): the membership created on
-- acceptance inherits these role_ids (alongside the direct `permissions`).
alter table public.invitations
  add column if not exists role_ids uuid[] not null default '{}';
