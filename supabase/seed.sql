-- Local/dev seed. Applied by `supabase start` and `supabase db reset`.
--
-- Only accounts are seeded here: memberships and sessions need rows in
-- auth.users, which are created through Supabase Auth (the 4b contract tests
-- provision their own users via the local admin API; real users sign up).
-- Fixed UUIDs so dev tooling and docs can reference them.

insert into public.accounts (id, display_name, email, kind) values
  ('00000000-0000-4000-8000-00000000a001', 'Acme Staff', null, 'staff'),
  ('00000000-0000-4000-8000-00000000c001', 'Customer One', 'customer-one@example.com', 'customer'),
  ('00000000-0000-4000-8000-00000000c002', 'Customer Two', 'customer-two@example.com', 'customer');
