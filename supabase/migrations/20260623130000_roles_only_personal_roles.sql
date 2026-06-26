-- ADR-0014 Phase 2.D — roles-only data migration.
--
-- Move each membership's remaining DIRECT permissions into a per-membership
-- "personal role" (account-scoped, is_personal = true) referenced from
-- role_ids, then clear the direct slot. After this, roles are the single source
-- of truth for one-off grants.
--
-- Idempotent: once a membership's permissions are empty it is skipped, so a
-- re-run is a no-op. Behaviour-preserving while actor resolution still unions
-- direct ∪ expand(roleIds); it becomes load-bearing when 2.C flips resolution
-- to roles-only (the direct column is then always empty → the union is a no-op).
do $$
declare
  m record;
  rid uuid;
begin
  for m in
    select id, account_id, permissions
    from public.memberships
    where jsonb_array_length(permissions) > 0
  loop
    rid := gen_random_uuid();
    insert into public.roles
      (id, account_id, name, permissions, template_key, template_synced,
       is_personal)
    values
      (rid, m.account_id, 'Personal permissions', m.permissions, null, true,
       true);
    update public.memberships
      set role_ids = array_append(role_ids, rid),
          permissions = '[]'::jsonb
    where id = m.id;
  end loop;
end $$;
