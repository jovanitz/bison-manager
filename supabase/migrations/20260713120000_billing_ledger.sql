-- Billing ledger: charges + payments (ADR-0018).
--
-- The manual-billing source of truth. Coverage / balance / phase are DERIVED
-- (the domain `deriveCoverage` over these rows + the subscription facts) and
-- never stored, so the card and the ledger cannot disagree. Money is stored as
-- integer minor units + a currency (never floats). Charges are MUTABLE — a
-- settlement sets status/paid_at/covered_through in place; payments are
-- APPEND-ONLY — a void/refund adds a compensating row (reversal_of), never an
-- edit. RLS fails closed like the rest of billing: reached only through the
-- service connection (the application layer enforces billing.read/plans.manage).

-- charges ---------------------------------------------------------------------
-- One period's bill. subtotal/tax/total + tax_rate_bps + grace_days are
-- SNAPSHOTS at generation time, so later plan/price/policy changes never rewrite
-- history. covered_through = period_to + downtime credit, set once on payment.
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  period_from timestamptz not null,
  period_to timestamptz not null,
  due_date timestamptz not null,
  subtotal_minor bigint not null,
  tax_rate_bps int not null check (tax_rate_bps >= 0),
  tax_minor bigint not null,
  total_minor bigint not null,
  currency text not null,
  grace_days int not null check (grace_days >= 0),
  status text not null check (status in ('open', 'paid', 'void')),
  paid_at timestamptz,
  covered_through timestamptz
);

create index charges_account_id_idx on public.charges (account_id, due_date);

-- payments --------------------------------------------------------------------
-- Money movements applied FIFO to charges. kind: payment (money in) | void (a
-- mistaken payment reversed) | refund (money actually returned) | credit
-- (goodwill). reversal_of links a void/refund to the payment it compensates.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in ('payment', 'void', 'refund', 'credit')),
  amount_minor bigint not null,
  currency text not null,
  applied_to uuid[] not null default '{}',
  reversal_of uuid references public.payments (id) on delete restrict,
  recorded_by_membership_id text not null,
  reason text not null,
  occurred_at timestamptz not null
);

create index payments_account_id_idx
  on public.payments (account_id, occurred_at desc);

-- Corrections are compensating rows (ADR-0018 D5) — payments never edited.
create trigger payments_no_update_delete
  before update or delete on public.payments
  for each row execute function public.billing_events_append_only();

alter table public.charges enable row level security;
alter table public.payments enable row level security;
