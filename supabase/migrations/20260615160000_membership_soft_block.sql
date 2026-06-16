-- Membership-level soft block: an org admin blocks one user inside their OWN
-- org (own scope, `members.block`). The blocked membership still authenticates,
-- but the policy denies every gated operation while that membership is the
-- active actor. Orthogonal to org/identity block and to the hard `disabled`
-- account status — the actor reader ORs all of them into `blocked`.
alter table public.memberships
  add column if not exists blocked boolean not null default false;
