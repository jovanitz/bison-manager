-- Defense-in-depth for the orphan-identity purge (access review, F4).
--
-- `memberships.user_id` referenced `auth.users(id) ON DELETE CASCADE`, so
-- erasing an identity SILENTLY erased its memberships. The purge use case guards
-- against deleting a member's identity at the application level, but there is a
-- real check→delete race: an orphan who accepts an invitation or creates an org
-- in that window would have their brand-new membership destroyed by the cascade,
-- irreversibly, with no `member.removed` event.
--
-- RESTRICT makes the database itself the last line of defense: deleting an
-- auth.users row that still has ANY membership now FAILS (foreign-key violation)
-- instead of cascading. The purge's Supabase adapter already fails closed on a
-- non-2xx, so the race resolves to a refused delete, not a destroyed member.
--
-- No legitimate flow deletes an identity that still holds memberships: removing a
-- member deletes the membership (not the identity), and deleting an org is a
-- soft-delete of the account. So RESTRICT never blocks a real operation.
alter table public.memberships
  drop constraint if exists memberships_user_id_fkey;

alter table public.memberships
  add constraint memberships_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete restrict;
