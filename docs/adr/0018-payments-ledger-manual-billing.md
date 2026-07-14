# ADR-0018: Payments as a ledger — manual-billing lifecycle, derived coverage

- Status: Accepted (owner sign-off 2026-07-08; not yet implemented)
- Date: 2026-07-08
- Builds on / refines: [ADR-0016](0016-plans-subscriptions-entitlements.md)
  (plans/subscriptions/entitlements — this ADR keeps its plan catalog,
  entitlements and growth enforcement untouched, and **evolves the payment side**
  of the subscription: `paidThroughAt` stops being an absolute staff setter and
  becomes **derived from a ledger**). Also repeats the provider-agnostic seam of
  [ADR-0008](0008-provider-agnostic-auth-and-api.md) (a `NotificationSender`
  port for dunning; the `PaymentGateway` port stays undefined — no processor
  yet) and the `Result`/no-throw, ports-as-types, audit-atomic idioms of
  [ADR-0003](0003-result-over-exceptions.md)/[ADR-0004](0004-ports-and-adapters-as-types.md).

## Context

ADR-0016 modelled billing as facts + derived phase, with **staff manual levers
as the bridge until payments exist** and `paidThroughAt` written by an absolute
`markPaid(DATE)` setter. That is enough to gate access but cannot answer the
questions manual billing actually needs: _how much does this org owe? which
months did they pay? how much did we collect in July? what happens when they
pay late, or partially, or after being cut off, or ask for a refund?_ A single
`paidThroughAt` date is a summary with no history behind it, and the org-detail
prototype grew a **payments ledger UI that is pure fixtures** — disconnected
from the paid-through date, so the two can contradict.

A gap review (2026-07-08, 12 gaps) was run against the manual-billing model and
each gap was decided by the owner. This ADR records the resulting payments
model. **Payments are still recorded by staff by hand** (bank transfer / deposit
/ OXXO — no processor); the change is that they are recorded as **ledger
movements**, and coverage is derived from them.

## Decision

### 1 — The ledger is the source of truth; coverage is derived

An account's billing state is a **ledger**: an append-only, ordered list of
`Charge`s (what we billed, per period) and `Payment`s (money movements). From
the ledger we **derive** `paidThroughAt`, the outstanding `balance`, and the
subscription `phase` — none of these is stored as an authoritative field.

This **supersedes ADR-0016's absolute `markPaid(paidThroughAt)`** as the primary
path. `markPaid`-as-absolute-date survives only as a manual **override**
("Adjust coverage"), and even it writes a **ledger adjustment**, never a direct
date poke — so the invariant _"`paidThroughAt` is always derived from the
ledger"_ holds with no exceptions. The subscription's Stripe-shaped facts
(`startedAt`, `trialEndsAt`, `planId`, `canceledAt`, `overrides`) stay as in
ADR-0016; `paidThroughAt` moves from _stored fact_ to _derived value_.

The subscription card and the ledger UI become **two views of one ledger** and
can no longer disagree — closing the prototype's contradiction.

### 2 — Money as integer minor units, currency-carrying, multi-country-ready

All money is a `Money` value object holding an **integer amount in the
currency's smallest unit** plus its currency — never a float, never a decimal
string. `0.1 + 0.2` and `parseFloat("49.99") * 100` are the class of bug this
forbids. `number` is exact for integers below 2^53 (≈ $90 trillion in cents), so
**no `bigint` / `decimal.js`** — the domain stays dependency-free.

```ts
type CurrencyCode = 'MXN'; // a small union; widening it makes TS demand each new
// currency's exponent + formatter — compiler-guided expansion
type Money = { readonly minor: number; readonly currency: CurrencyCode };
// money(minor, currency): Result<Money, BillingDomainError>  — integer + finite check
// add / subtract / compare  — pure; reject mixed currencies (Result)
```

Multi-country is designed in now (MXN only in practice):

- The **minor-unit exponent is a property of the currency**, never a hardcoded
  `×100`: ISO 4217 has 2-decimal (MXN/USD), **0-decimal (JPY/CLP)** and
  **3-decimal (KWD/BHD)** currencies. A per-currency registry `{ exponent,
symbol }` is used **only at the parse/format edges** (adapter/UI). Domain math
  is integer and currency-agnostic (it only rejects mixing).
- **Parsing avoids floats**: `"49.99" → 4999` by splitting the decimal string
  and padding, **not** `parseFloat × 100`. Formatting `4999 → "$49.99"` lives at
  the UI edge (`Intl.NumberFormat`); the domain never sees a `$` or a decimal.
- **One currency per account** (its country), fixed at creation → an account's
  whole ledger is single-currency.
- **No FX conversion in the billing core, ever.** Each account bills in its own
  currency; consolidated cross-country revenue does FX at report time, outside
  billing.

### 3 — Coverage derivation: FIFO, whole-period, overpay → credit

- **Payments apply FIFO** — to the oldest open charge first. This makes paid
  charges a consecutive prefix (no holes), so **`paidThroughAt` = the end date
  of the last paid charge** (± the downtime shift of Decision 4).
- **A charge is all-or-nothing for coverage.** There are **no partial
  payments**: an org either pays a period or falls into grace → block (Decision
  4); it is never left half-covered. (A charge is `open` or `paid`; a mid-period
  coverage date is unrepresentable — deliberately.)
- **Overpayment → a credit balance** that auto-consumes future charges — this is
  how **prepay / annual-up-front** works for free.
- **Balance** = Σ(open charge totals) − credits.

### 4 — Lifecycle: grace → suspended → dormant; no auto-cancel; downtime credit

The product-visible phase refines ADR-0016's `past_due` into two states plus a
triage flag, and drops any time-based auto-cancel:

| phase       | service | meaning                                                          |
| ----------- | ------- | ---------------------------------------------------------------- |
| `trialing`  | on      | inside the trial window                                          |
| `active`    | on      | `paidThroughAt` in the future                                    |
| `grace`     | **on**  | period ended, unpaid, inside the grace window (countdown)        |
| `suspended` | **off** | grace elapsed; **recoverable anytime by paying; NO auto-cancel** |
| `canceled`  | off     | explicit cancel only (Decision 8)                                |

`dormant` is **not a phase** — it is a triage flag on a `suspended` account
idle ≥ the dormant window, surfacing it for **manual** deletion review
(Decision 8). Phase stays **derived** (ADR-0016), now over the ledger + policy.

**Debt freezes on suspension.** While `suspended`, **no new charges are
generated** — only the charge that triggered the block stays open, so debt is
bounded. On payment, charge generation **resumes**, anchored to the (possibly
shifted) date.

**Downtime credit is derivable from the ledger — no suspension-episode log is
needed** (a manual-billing suspension has one start and one end, both already
known):

```
suspensionStart = charge.dueDate + charge.graceDays        // derivable
suspensionEnd   = payment.occurredAt                        // recorded on the Payment
downtime        = max(0, suspensionEnd − suspensionStart)   // 0 if paid within grace
newPaidThrough  = charge.period.to + downtime               // the anchor shifts forward, permanently
```

Paying within grace ⇒ `downtime = 0` ⇒ the renewal date does **not** move
(service never stopped). Being off N days ⇒ the date shifts forward exactly N
days (they never pay for time without service). **Cap:** if `downtime` exceeds
the **dormant window**, no credit is accrued — the payment **starts a fresh
period from the pay date** and the stale charge is `void`ed (credit is not
unbounded). _(Crediting for OUR outages — service down on our side — would need
separate recording and is out of scope.)_

**Policy values are configuration, not constants, and are snapshotted onto each
charge** so changing policy never rewrites history: `graceDays` (default **10**)
and the dormant/cap window (default **3 months**). **Global to start**; the
snapshot-on-charge design lets them later become per-plan or per-org with no
rewiring. They live behind a billing-settings screen (staff, permissioned).

### 5 — Amounts & tax: invoice-ready, no SAT integration

A charge's amount is the **plan price snapshotted at charge time** (a later plan
price change never touches existing charges; new charges use the new price — the
same snapshot principle as `graceDays`).

The plan price is **net**; each charge stores **`subtotal` + `tax` + `total`**
plus the **tax rate snapshotted**, so the ledger can generate an invoice later
**without** integrating the SAT / CFDI timbrado (that stays a separate future
module — a `PAC`/e-invoice adapter). Tax math stays float-free:

```
taxRateBps = 1600                                  // 16% as integer basis points, snapshotted
tax        = round(subtotal.minor × taxRateBps / 10000)  // computed ONCE, stored; half-up rounding
total      = subtotal + tax
```

The rate is per-jurisdiction later (16% MX now); rounding policy (**half-up**)
is fixed once here — the one place Decision 2's "division danger zone" bites.

### 6 — Corrections: append-only; void ≠ refund

The ledger is **append-only** — a movement is never edited or deleted; a mistake
is corrected by a **new compensating movement** (the only sound model for money

- audit; ADR-0016's audit-atomic writes already make an unaudited mutation
  unrepresentable). Two **distinct** operations (kept distinct, not merged):

* **void** — a payment recorded that **never really happened** (mistake) → a
  reversal entry; coverage recomputes **down** (the org can fall back to
  `grace`/`suspended`, correctly).
* **refund** — money **actually returned** to the customer → a money-out entry;
  the debt returns and accounting shows a real egress.

Both carry a **mandatory `reason`** and require staff permission; phase and
`paidThroughAt` recompute automatically. The same append-only pattern serves a
manual **goodwill credit** ("free month" = a credit entry).

### 7 — Customer-facing: read-only status, staff-recorded payments, dunning

With no processor, the customer **pays out of band and staff records the
payment** — the customer never self-confirms. But the customer is **not blind**:
their own app shows their billing state **read-only** — `paidThroughAt`, amount
owed, the suspension date, and how-to-pay instructions.

**Dunning** turns the staff-facing countdown into customer email. The triggers
derive from ledger dates; the channel is a new **`NotificationSender` port**
(ADR-0008 provider-agnostic seam). Three touchpoints: (1) charge due / grace
starts, (2) N days before suspension, (3) on suspension.

### 8 — Cancellation (period-end, self-service) & deletion (soft, fiscal retention)

**Cancellation** is explicit and distinct from suspension (which is
non-payment, recoverable). It takes effect **at the end of the paid period**:
access continues until `paidThroughAt` (already paid for), no further charges
are generated, then the account goes `canceled`/off — **no refund** (consistent
with no-proration). Always re-subscribable (a fresh period from that day). The
**customer cancels self-service** from their app; no staff step.

**Deletion** is manual (staff, from the dormant list), **soft and staged**, and
constrained by law: Mexican fiscal rules require keeping accounting records
~5 years, so _"delete the org" ≠ "delete the ledger"_. On delete: operational
data + PII (members, content, emails) are **deleted/anonymized** (LFPDPPP); the
**financial ledger is archived and retained** (de-identified) for the fiscal
period. Flow: staff marks _delete_ → `pending-deletion` (reversible) → after
**30 days** operational data is purged, ledger kept. A data export is offered
before deletion.

### 9 — Robustness (standard, no product decision)

- **Idempotency**: a payment settles a **specific charge**; the charge id guards
  against double-recording the same period.
- **Concurrency**: optimistic lock on the derived state (two staff recording at
  once cannot silently clobber) — the ADR-0016 `expectedVersion` precedent.
- **Timezone**: phase derivation is pinned to the **business timezone**, not
  UTC-naive — "today" for the `active` vs `grace` boundary is well-defined.

## Domain-model sketch (illustrative — not final code)

```ts
// libs/domain/src/billing/money
type CurrencyCode = 'MXN';
type Money = { readonly minor: number; readonly currency: CurrencyCode };

// libs/domain/src/billing/ledger
type ChargeStatus = 'open' | 'paid' | 'void';
type Charge = {
  readonly id: ChargeId;
  readonly accountId: string;
  readonly planId: string;
  readonly period: { readonly from: string; readonly to: string }; // coverage window
  readonly dueDate: string; // = period.from (the anchor)
  readonly subtotal: Money; // plan price snapshot (net)
  readonly taxRateBps: number; // snapshot (e.g. 1600)
  readonly tax: Money; // round(subtotal × bps / 10000), once
  readonly total: Money; // subtotal + tax
  readonly graceDays: number; // policy snapshot
  readonly status: ChargeStatus;
};

type PaymentKind = 'payment' | 'void' | 'refund' | 'credit';
type Payment = {
  readonly id: PaymentId;
  readonly accountId: string;
  readonly kind: PaymentKind;
  readonly amount: Money; // applied FIFO to open charges
  readonly appliedTo: readonly ChargeId[];
  readonly reversalOf?: PaymentId; // void / refund target
  readonly recordedByMembershipId: string;
  readonly reason: string; // mandatory
  readonly occurredAt: string;
};

// pure derivation over the ledger + policy + clock
type BillingPolicy = {
  readonly graceDays: number;
  readonly dormantDays: number;
};
type Coverage = {
  readonly paidThroughAt: string | null;
  readonly balance: Money;
  readonly phase: 'trialing' | 'active' | 'grace' | 'suspended' | 'canceled';
  readonly dormant: boolean;
};
declare const deriveCoverage: (input: {
  readonly subscription: Subscription; // ADR-0016 facts (trialEndsAt, canceledAt, …)
  readonly charges: readonly Charge[];
  readonly payments: readonly Payment[];
  readonly now: string;
  readonly policy: BillingPolicy;
}) => Coverage;
```

New application slice `billing-ledger` (ports `ChargeStore`/`PaymentStore`,
`errors.ts`, `use-cases.ts`: `recordPayment`, `voidPayment`, `refund`,
`adjustCoverage`, `generateCharges`, `cancelSubscription`); new ports
`NotificationSender` (dunning) and the still-undefined `PaymentGateway`.

## Rejected alternatives

- **Date is the source of truth, ledger is decorative** (ADR-0016 status quo) —
  cannot do accounting, per-month collection, or downtime credit, and lets the
  card and ledger contradict. Rejected in favour of Decision 1.
- **Floats / decimal strings for money** — the `0.1 + 0.2` bug class; forbidden
  by Decision 2.
- **Proration / partial coverage** — a $30-of-$49 payment buying ~18 days.
  Rejected: non-payment blocks rather than half-covers, so partials don't occur;
  avoids fractional-day dates and a rounding policy for coverage.
- **Recording suspension episodes to compute downtime** — unnecessary under the
  freeze model (Decision 4): a billing suspension has one derivable start
  (`due + grace`) and one recorded end (the payment). Would be needed only for
  our-side outage credits (out of scope).
- **Merging void and refund into one "reversal"** — they are accounting-distinct
  (no money moved vs money out); merging dirties the "what did we collect"
  report. Kept distinct (Decision 6).
- **Immediate cancellation with proration refund** — reopens the proration
  Decision 3 avoids and claws back paid time. Rejected for period-end
  (Decision 8).
- **Hard-delete of a dormant org** — illegal for the financial records
  (fiscal retention); Decision 8 soft-deletes and archives the ledger.
- **CFDI/SAT timbrado now** — a separate large module (PAC, RFC, uso CFDI,
  cancellations). Deferred; the ledger is kept invoice-ready (Decision 5).

## Accepted trade-offs (owner, 2026-07-08)

1. **Manual payment recording** — collection is offline and staff-entered; the
   ledger's accuracy depends on staff discipline (mitigated by dunning +
   append-only audit + the customer's read-only view surfacing discrepancies).
2. **Downtime credit is generous** — a customer off 3 days pays for the period
   and gets those 3 days back; capped only by the dormant-window fresh-start.
   Accepted as the owner's fairness stance ("no pagas lo que no tuviste").
3. **Prepay creates a credit balance** the ledger must carry and consume —
   accepted as the mechanism for annual/up-front payment.

## Owner decisions record (2026-07-08)

- **P1** — Source of truth = the **ledger** (charges + payments); paid-through &
  balance derived.
- **P2** — Money = **integer minor units** + `Money` VO; exponent per currency;
  one currency per account; no FX in core. MXN now, multi-country later.
- **P3** — FIFO application; **whole-period** coverage (no partials);
  overpayment → **credit balance**.
- **P4** — On suspension the debt **freezes**; downtime credit is **derived**
  (`max(0, pay − (due + grace))`), capped by the dormant window (fresh start).
  Policy (`graceDays` 10, dormant 3 months) is **configurable + snapshotted**,
  global to start. **No auto-cancel.**
- **P5** — **Invoice-ready, no SAT**: charge stores net **subtotal + tax +
  total** with the rate snapshotted (bps, half-up); plan price is net; CFDI
  deferred.
- **P6** — Corrections are **append-only**; **void ≠ refund** (both audited,
  reasoned); goodwill credit is the same pattern.
- **P7** — Customer sees billing **read-only** + how-to-pay; **staff records**
  payment; **dunning** by email at due / pre-suspend / suspended.
- **P8** — Cancel at **period end**, **self-service**, no refund, re-subscribable.
- **P9** — Dormant → **soft-delete**: purge operational data + PII, **retain the
  fiscal ledger**; 30-day reversible `pending-deletion`; export offered.
