-- Eager template propagation (ADR-0014): each role instance tracks whether it
-- still follows its staff template. `true` = a staff edit to the template
-- propagates to it; flips to `false` when the org edits the role locally (a
-- fork); a reset re-syncs it. Only meaningful with a `template_key`; custom
-- roles carry the default inertly. Existing rows default to synced.
alter table public.roles
  add column if not exists template_synced boolean not null default true;
