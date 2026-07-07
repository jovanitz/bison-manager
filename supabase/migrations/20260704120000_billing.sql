-- Billing: plans, subscriptions & the billing audit stream (ADR-0016).
--
-- Mirrors the access-model idioms one-for-one: a staff-editable catalog with a
-- code floor (DEFAULT_PLANS), audit-atomic writes (mutation + event in one
-- transaction), retire-never-delete, optimistic concurrency on the
-- highest-blast-radius row (plans.version). Billing events are their OWN
-- audit stream — the access audit_events union stays untouched.

-- plans -----------------------------------------------------------------------
-- The staff-editable catalog (ADR-0016 Decision 2). `key` is the stable slug
-- (customers only ever see display_name); hidden+active = staff-assignable
-- only (the home of legacy/custom plans); retired = frozen, closed to ALL new
-- subscriptions. `price` null = "not decided yet" is first-class;
-- price_set_at anchors the delinquency grace window (stamped exactly once).
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null,
  internal_note text not null,
  status text not null check (status in ('active', 'retired')),
  visibility text not null check (visibility in ('public', 'hidden')),
  is_default boolean not null default false,
  entitlements jsonb not null,
  trial_months int not null check (trial_months >= 0),
  price jsonb,
  price_set_at timestamptz,
  version int not null
);

-- Exactly one default plan for new orgs (the memberships_single_root_idx idiom).
create unique index plans_single_default_idx
  on public.plans (is_default)
  where is_default;

-- subscriptions ---------------------------------------------------------------
-- One per customer account; FACTS only — phase is always derived (the domain
-- subscriptionPhase over facts + clock). plan_id is a live reference (edits
-- propagate, D3) and restrict-on-delete: plans are retired, never deleted out
-- from under subscribers. created_by_user_id is the trial-farming audit fact:
-- uuid like auth.users(id) but deliberately WITHOUT the FK, so the fact
-- survives identity deletion. trial_expiry_recorded_at is the CAS marker for
-- exactly-once `subscription.trial-expired` recording (grant.expired
-- precedent: concurrent observers emit one event, not N).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  created_by_user_id uuid not null,
  started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  paid_through_at timestamptz,
  canceled_at timestamptz,
  overrides jsonb,
  trial_expiry_recorded_at timestamptz
);

create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index subscriptions_created_by_user_id_idx
  on public.subscriptions (created_by_user_id);

-- billing_events --------------------------------------------------------------
-- Append-only; during the manual-billing era this trail IS the accounting.
-- Every store write inserts its event in the same transaction as the mutation
-- (the port signatures make an unaudited staff lever unrepresentable).
-- seq: stable ordering — occurred_at can collide (audit_events precedent).
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  seq bigint generated always as identity
);

create unique index billing_events_seq_idx on public.billing_events (seq);
create index billing_events_type_idx
  on public.billing_events (type, occurred_at desc);

create or replace function public.billing_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'billing_events is append-only';
end;
$$;

create trigger billing_events_no_update_delete
  before update or delete on public.billing_events
  for each row execute function public.billing_events_append_only();

-- Seed the code floor idempotently: a staff-edited live plan is never
-- silently overwritten by a deploy. Values must match DEFAULT_PLANS in
-- libs/domain/src/billing/plan/seeds.ts exactly.
insert into public.plans
  (key, display_name, internal_note, status, visibility, is_default,
   entitlements, trial_months, price, price_set_at, version)
values (
  'free',
  'Free',
  'The acquisition plan — every new org is born here.',
  'active',
  'public',
  true,
  '{"limits":{"maxOrganizationsOwned":1,"maxMembersPerOrg":3},"features":[]}'::jsonb,
  3,
  null,
  null,
  1
)
on conflict (key) do nothing;

-- RLS: fail closed — like audit_events/role_templates, NO client policies.
-- The API reaches billing only through its service connection (application
-- layer enforces `plans.manage`/`billing.read`); hidden plan names encode who
-- got special terms and must never leak through PostgREST.
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
