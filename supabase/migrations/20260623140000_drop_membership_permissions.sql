-- ADR-0014 Phase 2 (roles-only — the expand-contract "contract" step).
--
-- A membership's effective permissions are now EXACTLY expand(role_ids): one-off
-- grants live in a per-membership personal role (created at provisioning and
-- backfilled by 20260623130000). Actor resolution, the anti-orphan count and the
-- one-off readers no longer reference the direct `permissions` column — it is
-- dead. Drop it so roles are the single source of truth in the schema too.
alter table public.memberships drop column if exists permissions;
